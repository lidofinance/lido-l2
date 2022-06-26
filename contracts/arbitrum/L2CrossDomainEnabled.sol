// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IArbSys} from "./interfaces/IArbSys.sol";

/// @author psirex
/// @notice A helper contract to simplify Arbitrum to Ethereum communication process
contract L2CrossDomainEnabled {
    uint160 private constant ADDRESS_OFFSET =
        uint160(0x1111000000000000000000000000000000001111);

    /// @notice Address of the Arbitrum’s ArbSys contract
    IArbSys public immutable arbSys;

    /// @param arbSys_ Address of the Arbitrum’s ArbSys contract
    constructor(address arbSys_) {
        arbSys = IArbSys(arbSys_);
    }

    /// @notice Sends the message to the Ethereum chain
    /// @param sender_ Address of the sender of the message
    /// @param recipient_ Address of the recipient of the message on the Ethereum chain
    /// @param data_ Data passed to the recipient in the message
    /// @return id Unique identifier for this L2-to-L1 transaction
    function sendCrossDomainMessage(
        address sender_,
        address recipient_,
        bytes memory data_
    ) internal returns (uint256 id) {
        id = IArbSys(arbSys).sendTxToL1(recipient_, data_);
        emit TxToL1(sender_, recipient_, id, data_);
    }

    /// @dev L1 addresses are transformed durng l1 -> l2 calls
    function applyL1ToL2Alias(address l1Address_)
        private
        pure
        returns (address l1Address)
    {
        unchecked {
            l1Address = address(uint160(l1Address_) + ADDRESS_OFFSET);
        }
    }

    /// @notice Validates that the sender address with applied Arbitrum's aliasing is equal to
    ///     the crossDomainAccount_ address
    modifier onlyFromCrossDomainAccount(address crossDomainAccount_) {
        if (msg.sender != applyL1ToL2Alias(crossDomainAccount_)) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    event TxToL1(
        address indexed from,
        address indexed to,
        uint256 indexed id,
        bytes data
    );

    error ErrorWrongCrossDomainSender();
}
