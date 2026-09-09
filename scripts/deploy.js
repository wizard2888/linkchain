const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying LinkChain to ${hre.network.name}...`);
  console.log(`Owner and treasury will be: ${deployer.address}`);

  const registrationFee = ethers.parseEther("0.01"); // adjust as desired
  const boostFee = ethers.parseEther("0.005"); // adjust as desired

  const LinkChain = await hre.ethers.getContractFactory("LinkChain");
  const contract = await LinkChain.deploy(deployer.address, deployer.address, registrationFee, boostFee);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`LinkChain deployed to: ${address}`);
  console.log(`Registration fee: ${ethers.formatEther(registrationFee)} BOT`);
  console.log(`Boost fee: ${ethers.formatEther(boostFee)} BOT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
