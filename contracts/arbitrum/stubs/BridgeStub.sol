// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IBridge} from "../interfaces/IBridge.sol";

contract BridgeStub is IBridge {
    address public activeOutbox;

    constructor(address activeOutbox_) payable {
        activeOutbox = activeOutbox_;
    }

    function finalizeInboundTransfer(
        address target_,
        bytes memory data // data_
    ) external {
        target_.call(data);
    }

    function setOutbox(address outbox_) external {
        activeOutbox = outbox_;
    }
}
