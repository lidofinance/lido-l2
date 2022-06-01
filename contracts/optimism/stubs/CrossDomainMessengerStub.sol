// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ICrossDomainMessenger} from "../interfaces/ICrossDomainMessenger.sol";

contract CrossDomainMessengerStub is ICrossDomainMessenger {
    address public xDomainMessageSender;
    uint256 public messageNonce;

    constructor() payable {}

    function setXDomainMessageSender(address value) external {
        xDomainMessageSender = value;
    }

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external {
        messageNonce += 1;
        emit SentMessage(
            _target,
            msg.sender,
            _message,
            messageNonce,
            _gasLimit
        );
    }
}
