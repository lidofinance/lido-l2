// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {IArbSys} from "./interfaces/IArbSys.sol";

/// @author psirex
/// @notice A helper contract to simplify Arbitrum to Ethereum communication process
contract L2CrossDomainEnabled {
    /// @notice Address of the Arbitrum’s ArbSys contract
    IArbSys public immutable arbSys;

    /// @param arbSys_ Address of the Arbitrum’s ArbSys contract
    constructor(address arbSys_) {
        arbSys = IArbSys(arbSys_);
    }

    /// @notice Sends the message to the Ethereum chain
    /// @param recipient_ Address of the recipient of the message on the Ethereum chain
    /// @param data_ Data passed to the recipient_ in the message
    function sendCrossDomainMessage(address recipient_, bytes memory data_)
        internal
        returns (uint256)
    {
        return IArbSys(arbSys).sendTxToL1(recipient_, data_);
    }

    /// @notice Validates that the sender address with applied Arbitrum's aliasing is equal to
    ///     the crossDomainAccount_ address
    modifier onlyFromCrossDomainAccount(address crossDomainAccount_) {
        uint160 offset = uint160(0x1111000000000000000000000000000000001111);
        address aliasedAccount = address(uint160(crossDomainAccount_) + offset);
        if (msg.sender != aliasedAccount) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    error ErrorWrongCrossDomainSender();
}
