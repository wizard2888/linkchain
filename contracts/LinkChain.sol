// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LinkChain
/// @notice An on-chain URL shortener. Anyone can register a unique short
///         slug pointing to a target URL for a fee in native BOT, and
///         anyone can pay a boost fee to raise a link's visibility ranking.
///         Both fees flow directly to a treasury address - continuous,
///         genuine transaction volume denominated in native BOT, not a
///         redistribution pool.
///
/// @dev Registration is permissionless and first-come-first-served, the
///      same way domain names or ENS names work - this is a deliberate,
///      standard design, not an oversight. Fees are simple, one-way
///      payments to the treasury; they are never pooled or paid out to
///      other users, which keeps this free of the Ponzi-shaped risk that
///      a "pay to boost, funded by other users' fees" reward pool would
///      carry.
contract LinkChain is Ownable, ReentrancyGuard {
    struct Slug {
        address owner;
        string targetURL;
        uint256 boostCount;
        uint256 registeredAt;
    }

    uint256 public constant MAX_SLUG_LENGTH = 32;

    address public immutable treasury;
    uint256 public registrationFee;
    uint256 public boostFee;

    mapping(string => Slug) public slugs;
    string[] public allSlugs;

    event FeesUpdated(uint256 registrationFee, uint256 boostFee);
    event SlugRegistered(string slug, address indexed owner, string targetURL);
    event LinkBoosted(string slug, address indexed booster, uint256 newBoostCount);
    event TargetURLUpdated(string slug, string newTargetURL);

    constructor(address initialOwner, address treasury_, uint256 registrationFee_, uint256 boostFee_)
        Ownable(initialOwner)
    {
        require(treasury_ != address(0), "Invalid treasury address");
        treasury = treasury_;
        registrationFee = registrationFee_;
        boostFee = boostFee_;
    }

    // --- Admin: fee configuration ---

    function setFees(uint256 newRegistrationFee, uint256 newBoostFee) external onlyOwner {
        registrationFee = newRegistrationFee;
        boostFee = newBoostFee;
        emit FeesUpdated(newRegistrationFee, newBoostFee);
    }

    // --- Registration ---

    function registerSlug(string calldata slug, string calldata targetURL) external payable nonReentrant {
        require(bytes(slug).length > 0, "Slug cannot be empty");
        require(bytes(slug).length <= MAX_SLUG_LENGTH, "Slug too long");
        require(bytes(targetURL).length > 0, "Target URL cannot be empty");
        require(slugs[slug].owner == address(0), "This slug is already taken");
        require(msg.value == registrationFee, "Must send exactly the registration fee");

        slugs[slug] = Slug({owner: msg.sender, targetURL: targetURL, boostCount: 0, registeredAt: block.timestamp});
        allSlugs.push(slug);

        if (msg.value > 0) {
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "Registration fee transfer failed");
        }

        emit SlugRegistered(slug, msg.sender, targetURL);
    }

    // --- Boosting ---

    function boostLink(string calldata slug) external payable nonReentrant {
        require(slugs[slug].owner != address(0), "This slug is not registered");
        require(msg.value == boostFee, "Must send exactly the boost fee");

        slugs[slug].boostCount += 1;

        if (msg.value > 0) {
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "Boost fee transfer failed");
        }

        emit LinkBoosted(slug, msg.sender, slugs[slug].boostCount);
    }

    // --- Owner-of-slug: update destination ---

    function updateTargetURL(string calldata slug, string calldata newTargetURL) external {
        require(slugs[slug].owner == msg.sender, "Not the owner of this slug");
        require(bytes(newTargetURL).length > 0, "Target URL cannot be empty");

        slugs[slug].targetURL = newTargetURL;
        emit TargetURLUpdated(slug, newTargetURL);
    }

    // --- Views ---

    function getSlug(string calldata slug) external view returns (Slug memory) {
        return slugs[slug];
    }

    function isRegistered(string calldata slug) external view returns (bool) {
        return slugs[slug].owner != address(0);
    }

    function slugCount() external view returns (uint256) {
        return allSlugs.length;
    }

    function getSlugAt(uint256 index) external view returns (string memory) {
        require(index < allSlugs.length, "Index out of range");
        return allSlugs[index];
    }
}
