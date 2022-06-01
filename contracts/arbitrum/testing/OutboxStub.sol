// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IOutbox} from "../interfaces/IOutbox.sol";

contract OutboxStub is IOutbox {
    address public l2ToL1Sender;

    function setL2ToL1Sender(address l2ToL1Sender_) external {
        l2ToL1Sender = l2ToL1Sender_;
    }
}
