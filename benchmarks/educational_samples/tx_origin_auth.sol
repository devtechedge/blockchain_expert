// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.
pragma solidity 0.8.20;

contract OriginAuthWallet {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function setOwner(address next) external {
        require(tx.origin == owner, "not owner");
        owner = next;
    }

    function pull() external {
        require(tx.origin == owner, "not owner");
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
