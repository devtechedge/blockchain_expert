// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.
pragma solidity 0.8.20;

contract OpenTreasury {
    function withdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }

    function retire(address payable recipient) external {
        selfdestruct(recipient);
    }

    receive() external payable {}
}
