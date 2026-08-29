// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.
pragma solidity 0.8.20;

contract BlockSeedPicker {
    function pick(address[] calldata players) external view returns (address winner) {
        require(players.length > 0, "empty");
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, players.length)));
        winner = players[seed % players.length];
    }
}
