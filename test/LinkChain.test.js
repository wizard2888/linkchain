const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LinkChain", function () {
  let contract, owner, treasury, alice, bob, outsider;
  const REG_FEE = ethers.parseEther("0.01");
  const BOOST_FEE = ethers.parseEther("0.005");

  beforeEach(async function () {
    [owner, treasury, alice, bob, outsider] = await ethers.getSigners();
    const LinkChain = await ethers.getContractFactory("LinkChain");
    contract = await LinkChain.deploy(owner.address, treasury.address, REG_FEE, BOOST_FEE);
    await contract.waitForDeployment();
  });

  describe("fee configuration", function () {
    it("only the owner can update fees", async function () {
      await expect(contract.connect(outsider).setFees(0, 0)).to.be.revertedWithCustomError(
        contract,
        "OwnableUnauthorizedAccount"
      );
      await contract.connect(owner).setFees(ethers.parseEther("0.02"), ethers.parseEther("0.01"));
      expect(await contract.registrationFee()).to.equal(ethers.parseEther("0.02"));
      expect(await contract.boostFee()).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("registering a slug", function () {
    it("registers correctly and forwards the fee to the treasury", async function () {
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await contract.connect(alice).registerSlug("mylink", "https://example.com", { value: REG_FEE });
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      const s = await contract.getSlug("mylink");
      expect(s.owner).to.equal(alice.address);
      expect(s.targetURL).to.equal("https://example.com");
      expect(s.boostCount).to.equal(0n);
      expect(treasuryAfter - treasuryBefore).to.equal(REG_FEE);
    });

    it("rejects registering an already-taken slug", async function () {
      await contract.connect(alice).registerSlug("taken", "https://a.com", { value: REG_FEE });
      await expect(
        contract.connect(bob).registerSlug("taken", "https://b.com", { value: REG_FEE })
      ).to.be.revertedWith("This slug is already taken");
    });

    it("rejects an incorrect fee amount", async function () {
      await expect(
        contract.connect(alice).registerSlug("mylink", "https://example.com", { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Must send exactly the registration fee");
    });

    it("rejects an empty slug or empty target URL", async function () {
      await expect(contract.connect(alice).registerSlug("", "https://example.com", { value: REG_FEE })).to.be.revertedWith(
        "Slug cannot be empty"
      );
      await expect(contract.connect(alice).registerSlug("mylink", "", { value: REG_FEE })).to.be.revertedWith(
        "Target URL cannot be empty"
      );
    });

    it("rejects a slug longer than the max length", async function () {
      const tooLong = "a".repeat(33);
      await expect(
        contract.connect(alice).registerSlug(tooLong, "https://example.com", { value: REG_FEE })
      ).to.be.revertedWith("Slug too long");
    });

    it("tracks all registered slugs for enumeration", async function () {
      await contract.connect(alice).registerSlug("first", "https://a.com", { value: REG_FEE });
      await contract.connect(bob).registerSlug("second", "https://b.com", { value: REG_FEE });
      expect(await contract.slugCount()).to.equal(2n);
      expect(await contract.getSlugAt(0)).to.equal("first");
      expect(await contract.getSlugAt(1)).to.equal("second");
    });

    it("works correctly with a zero registration fee", async function () {
      await contract.connect(owner).setFees(0, BOOST_FEE);
      await expect(contract.connect(alice).registerSlug("freelink", "https://example.com", { value: 0 })).to.not.be
        .reverted;
    });
  });

  describe("boosting a link", function () {
    beforeEach(async function () {
      await contract.connect(alice).registerSlug("mylink", "https://example.com", { value: REG_FEE });
    });

    it("increments boost count and forwards the fee to the treasury", async function () {
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await contract.connect(bob).boostLink("mylink", { value: BOOST_FEE });
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      const s = await contract.getSlug("mylink");
      expect(s.boostCount).to.equal(1n);
      expect(treasuryAfter - treasuryBefore).to.equal(BOOST_FEE);
    });

    it("allows multiple boosts, including from the slug owner themselves", async function () {
      await contract.connect(bob).boostLink("mylink", { value: BOOST_FEE });
      await contract.connect(alice).boostLink("mylink", { value: BOOST_FEE });
      const s = await contract.getSlug("mylink");
      expect(s.boostCount).to.equal(2n);
    });

    it("rejects boosting a slug that isn't registered", async function () {
      await expect(contract.connect(bob).boostLink("doesnotexist", { value: BOOST_FEE })).to.be.revertedWith(
        "This slug is not registered"
      );
    });

    it("rejects an incorrect boost fee", async function () {
      await expect(
        contract.connect(bob).boostLink("mylink", { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Must send exactly the boost fee");
    });
  });

  describe("updating a slug's target URL", function () {
    beforeEach(async function () {
      await contract.connect(alice).registerSlug("mylink", "https://old.com", { value: REG_FEE });
    });

    it("allows the slug owner to update the destination", async function () {
      await contract.connect(alice).updateTargetURL("mylink", "https://new.com");
      const s = await contract.getSlug("mylink");
      expect(s.targetURL).to.equal("https://new.com");
    });

    it("prevents anyone else from updating it", async function () {
      await expect(contract.connect(bob).updateTargetURL("mylink", "https://evil.com")).to.be.revertedWith(
        "Not the owner of this slug"
      );
    });
  });

  describe("views", function () {
    it("reports isRegistered correctly", async function () {
      expect(await contract.isRegistered("mylink")).to.equal(false);
      await contract.connect(alice).registerSlug("mylink", "https://example.com", { value: REG_FEE });
      expect(await contract.isRegistered("mylink")).to.equal(true);
    });
  });
});
