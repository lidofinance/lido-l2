// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IInbox} from "../interfaces/IInbox.sol";

contract InboxStub is IInbox {
    uint256 public retryableTicketId;
    address public immutable bridge;

    constructor(address bridge_) {
        bridge = bridge_;
    }

    function setRetryableTicketId(uint256 retryableTicketId_) public {
        retryableTicketId = retryableTicketId_;
    }

    function createRetryableTicket(
        address destAddr,
        uint256 arbTxCallValue,
        uint256 maxSubmissionCost,
        address submissionRefundAddress,
        address valueRefundAddress,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable returns (uint256) {
        emit CreateRetryableTicketCalled(
            msg.value,
            destAddr,
            arbTxCallValue,
            maxSubmissionCost,
            submissionRefundAddress,
            valueRefundAddress,
            maxGas,
            gasPriceBid,
            data
        );
        return retryableTicketId;
    }

    event CreateRetryableTicketCalled(
        uint256 value,
        address destAddr,
        uint256 arbTxCallValue,
        uint256 maxSubmissionCost,
        address submissionRefundAddress,
        address valueRefundAddress,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes data
    );
}
