// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.
pragma solidity 0.8.20;

contract UncheckedForwarder {
    function forward(address target, bytes calldata data) external payable {
        target.call{value: msg.value}(data);
    }
}
