// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l1/contracts/vendor/AddressAliasHelper.sol";
import {IL2Messenger} from "./interfaces/IL2Messenger.sol";

/// @notice A helper contract to simplify zkSync to Ethereum communication process
contract L2CrossDomainEnabled {
    /// @dev All the system contracts introduced by zkSync have their addresses
    /// started from 2^15 in order to avoid collision with Ethereum precompiles.
    uint160 private constant SYSTEM_CONTRACTS_OFFSET = 0x8000; // 2^15

    /// @notice Address of the zkSync's L2Messenger contract
    IL2Messenger public constant L2_MESSENGER = IL2Messenger(address(SYSTEM_CONTRACTS_OFFSET + 0x08));

    /// @notice Sends the message to the Ethereum chain
    /// @param message_ Message passed to the recipient
    /// @return hash Keccak256 hash of the message bytes
    function sendCrossDomainMessage(bytes memory message_) internal returns (bytes32 hash) {
        hash = L2_MESSENGER.sendToL1(message_);
    }

    /// @notice Validates that the sender address with applied zkSync's aliasing is equal to
    ///     the crossDomainAccount_ address
    modifier onlyFromCrossDomainAccount(address crossDomainAccount_) {
        if (msg.sender != AddressAliasHelper.applyL1ToL2Alias(crossDomainAccount_)) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    error ErrorWrongCrossDomainSender();
}
