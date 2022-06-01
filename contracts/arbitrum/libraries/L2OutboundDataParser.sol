// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

library L2OutboundDataParser {
    function decode(address router, bytes memory data)
        internal
        view
        returns (address from)
    {
        bytes memory extraData;
        if (msg.sender == router) {
            (from, extraData) = abi.decode(data, (address, bytes));
        } else {
            (from, extraData) = (msg.sender, data);
        }
        if (extraData.length != 0) {
            revert ExtraDataNotEmpty();
        }
    }

    error ExtraDataNotEmpty();
}
