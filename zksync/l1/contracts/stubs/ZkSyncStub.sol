// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import {IMailbox, L2Log, L2Message, TxStatus} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";

contract ZkSyncStub is IMailbox {
    bytes32 public canonicalTxHash;
    
    function setCanonicalTxHash(bytes32 canonicalTxHash_) public {
        canonicalTxHash = canonicalTxHash_;
    }

    function proveL2MessageInclusion(
        uint256,
        uint256,
        L2Message calldata,
        bytes32[] calldata
    ) external pure returns (bool) {
        return true;
    }

    function proveL2LogInclusion(
        uint256,
        uint256,
        L2Log memory,
        bytes32[] calldata
    ) external pure returns (bool) {
        return true;
    }

    function proveL1ToL2TransactionStatus(
        bytes32,
        uint256,
        uint256,
        uint16,
        bytes32[] calldata,
        TxStatus
    ) external pure returns (bool) {
        return true;
    }

    function finalizeEthWithdrawal(
        uint256,
        uint256,
        uint16,
        bytes calldata,
        bytes32[] calldata
    ) external pure {
        return;
    }

    function requestL2Transaction(
        address _contractL2,
        uint256 _l2Value,
        bytes calldata _calldata,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        bytes[] calldata _factoryDeps,
        address _refundRecipient
    ) external payable returns (bytes32) {
        emit RequestL2TransactionCalled(
            msg.value,
            _contractL2,
            _l2Value,
            _calldata,
            _l2GasLimit,
            _l2GasPerPubdataByteLimit,
            _factoryDeps,
            _refundRecipient
        );
        return canonicalTxHash;
    }

    function l2TransactionBaseCost(
        uint256,
        uint256,
        uint256
    ) external pure returns (uint256) {
        return 0;
    }

    event RequestL2TransactionCalled(
        uint256 _value,
        address _contractL2,
        uint256 _l2Value,
        bytes _calldata,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        bytes[] _factoryDeps,
        address _refundRecipient
    );
}
