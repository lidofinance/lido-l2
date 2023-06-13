// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface IL1ERC20Bridge {
    function finalizeWithdrawal(
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBlock,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) external;
}
