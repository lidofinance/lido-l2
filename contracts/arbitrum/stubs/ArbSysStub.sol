// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

contract ArbSysStub {
    uint256 public l2ToL1TxId;

    function setl2ToL1TxId(uint256 l2ToL1TxId_) public {
        l2ToL1TxId = l2ToL1TxId_;
    }

    function sendTxToL1(address recipient, bytes calldata data)
        external
        payable
        returns (uint256)
    {
        l2ToL1TxId += 1;
        emit CreateL2ToL1Tx(recipient, data);
        return l2ToL1TxId;
    }

    event CreateL2ToL1Tx(address recipient, bytes data);
}
