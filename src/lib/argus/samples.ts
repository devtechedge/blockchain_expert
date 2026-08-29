export type SampleContract = {
  id: string;
  title: string;
  filename: string;
  swcFocus: string[];
  blurb: string;
  source: string;
};

const HEADER = `// SPDX-License-Identifier: MIT
// FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
// DO NOT DEPLOY TO ANY NETWORK.
// Fixture: vulnerability_sample / security_evaluator benchmark for Argus detectors.`;

export const SAMPLES: SampleContract[] = [
  {
    id: "reentrancy-vault",
    title: "Naive vault",
    filename: "reentrancy_vault.sol",
    swcFocus: ["SWC-107", "SWC-103"],
    blurb: "Value is sent before the accounting slot is updated.",
    source: `${HEADER}
pragma solidity ^0.8.20;

contract ReentrancyVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] -= amount;
    }
}
`,
  },
  {
    id: "tx-origin-auth",
    title: "Origin auth",
    filename: "tx_origin_auth.sol",
    swcFocus: ["SWC-115"],
    blurb: "Authorization compares against tx.origin instead of msg.sender.",
    source: `${HEADER}
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
`,
  },
  {
    id: "unchecked-call",
    title: "Unchecked call",
    filename: "unchecked_low_level_call.sol",
    swcFocus: ["SWC-104"],
    blurb: "Low-level call return value is discarded.",
    source: `${HEADER}
pragma solidity 0.8.20;

contract UncheckedForwarder {
    function forward(address target, bytes calldata data) external payable {
        target.call{value: msg.value}(data);
    }
}
`,
  },
  {
    id: "delegate-proxy",
    title: "Open proxy",
    filename: "delegatecall_proxy.sol",
    swcFocus: ["SWC-112"],
    blurb: "DELEGATECALL target is supplied by the caller.",
    source: `${HEADER}
pragma solidity 0.8.20;

contract OpenDelegateProxy {
    function forward(address target, bytes calldata data) external {
        (bool ok, ) = target.delegatecall(data);
        require(ok, "forward failed");
    }
}
`,
  },
  {
    id: "unprotected-withdraw",
    title: "Open withdraw",
    filename: "unprotected_withdraw.sol",
    swcFocus: ["SWC-105", "SWC-106"],
    blurb: "Anyone can move the contract balance or destroy the contract.",
    source: `${HEADER}
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
`,
  },
  {
    id: "weak-seed",
    title: "Block seed",
    filename: "block_attribute_seed.sol",
    swcFocus: ["SWC-120", "SWC-116"],
    blurb: "A payout seed is derived from a block attribute.",
    source: `${HEADER}
pragma solidity 0.8.20;

contract BlockSeedPicker {
    function pick(address[] calldata players) external view returns (address winner) {
        require(players.length > 0, "empty");
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, players.length)));
        winner = players[seed % players.length];
    }
}
`,
  },
  {
    id: "hardened-vault",
    title: "Hardened vault",
    filename: "hardened_vault.sol",
    swcFocus: [],
    blurb: "Control sample: pinned pragma, CEI, reentrancy lock, checked call.",
    source: `${HEADER}
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
`,
  },
];

export function sampleById(id: string): SampleContract | undefined {
  return SAMPLES.find((s) => s.id === id);
}
