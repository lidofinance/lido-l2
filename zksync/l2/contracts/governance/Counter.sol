// SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.10;

import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l1/contracts/vendor/AddressAliasHelper.sol";

contract Counter {
    uint256 public value = 0;
    // Address of the Ethereum Governance Executor, which should be able to queue actions sets
    address public governance;

    error UnauthorizedEthereumExecutor(string message);

    modifier onlyEthereumGovernanceExecutor() {
        if (AddressAliasHelper.undoL1ToL2Alias(msg.sender) != governance)
            revert UnauthorizedEthereumExecutor("Only governance is allowed");
        _;
    }

    constructor(address governanceExecutor) {
        governance = governanceExecutor;
    }

    function setGovernance(address newGovernance) public {
        governance = newGovernance;
    }

    function increment() public {
        value += 1;
    }
}
