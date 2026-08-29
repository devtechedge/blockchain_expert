// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.
pragma solidity 0.8.20;

contract HardenedVault {
    mapping(address => uint256) public balances;
    address public owner;
    bool private locked;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "locked");
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "insufficient");
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
