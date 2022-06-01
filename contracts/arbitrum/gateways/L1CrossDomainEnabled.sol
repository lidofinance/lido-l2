// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IInbox} from "../interfaces/IInbox.sol";
import {IBridge} from "../interfaces/IBridge.sol";
import {IOutbox} from "../interfaces/IOutbox.sol";

contract L1CrossDomainEnabled {
    IInbox public immutable inbox;

    constructor(address inbox_) {
        inbox = IInbox(inbox_);
    }

    struct CrossDomainMessageOptions {
        uint256 maxGas;
        uint256 callValue;
        uint256 gasPriceBid;
        address refundAddress;
        uint256 maxSubmissionCost;
    }

    function sendCrossDomainMessage(
        address recipient,
        bytes memory data,
        CrossDomainMessageOptions memory msgOptions
    ) internal returns (uint256) {
        return
            inbox.createRetryableTicket{value: msg.value}(
                recipient,
                msgOptions.callValue,
                msgOptions.maxSubmissionCost,
                msgOptions.refundAddress,
                msgOptions.refundAddress,
                msgOptions.maxGas,
                msgOptions.gasPriceBid,
                data
            );
    }

    modifier onlyFromCrossDomainAccount(address account) {
        address bridge = inbox.bridge();
        if (msg.sender != bridge) {
            revert ErrorUnauthorizedBridge();
        }

        address l2ToL1Sender = IOutbox(IBridge(bridge).activeOutbox())
            .l2ToL1Sender();

        if (l2ToL1Sender != account) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    error ErrorUnauthorizedBridge();
    error ErrorWrongCrossDomainSender();
}
