// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

/// @notice A fake ERC20 that always succeeds on transfer.
///         Used to demonstrate the claimFailedDeposit griefing attack
///         where a griefer passes a rubbish l1Token to delete someone
///         else's depositAmount record.
contract MaliciousToken {
    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function balanceOf(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function allowance(address, address) external pure returns (uint256) {
        return type(uint256).max;
    }
}
