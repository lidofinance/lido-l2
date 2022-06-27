// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author psirex
/// @notice A helper library to parse data passed to outboundTransfer() of L2ERC20TokenGateway
library L2OutboundDataParser {
    /// @dev Decodes value contained in data_ bytes array and returns it
    /// @param router_ Address of the Arbitrum’s L2GatewayRouter
    /// @param data_ Data encoded for the outboundTransfer() method
    /// @return from_ address of the sender
    function decode(address router_, bytes memory data_)
        internal
        view
        returns (address from_)
    {
        bytes memory extraData;
        if (msg.sender == router_) {
            (from_, extraData) = abi.decode(data_, (address, bytes));
        } else {
            (from_, extraData) = (msg.sender, data_);
        }
        if (extraData.length != 0) {
            revert ExtraDataNotEmpty();
        }
    }

    error ExtraDataNotEmpty();
}
