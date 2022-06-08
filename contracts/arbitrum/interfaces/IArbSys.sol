// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.4.21;

interface IArbSys {
    function sendTxToL1(address destination_, bytes calldata calldataForL1_)
        external
        payable
        returns (uint256);
}
