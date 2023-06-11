// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IL2Messenger} from "./interfaces/IL2Messenger.sol";

/// @notice A helper contract to simplify zkSync to Ethereum communication process
contract L2CrossDomainEnabled {
    uint160 private constant ADDRESS_OFFSET =
        uint160(0x1111000000000000000000000000000000001111);

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

    /// @notice Utility function converts the address that submitted a tx
    /// to the inbox on L1 to the msg.sender viewed on L2
    /// @param l1Address_ the address in the L1 that triggered the tx to L2
    /// @return l2Address L2 address as viewed in msg.sender
    function applyL1ToL2Alias(address l1Address_) internal pure returns (address l2Address) {
        unchecked {
            l2Address = address(uint160(l1Address_) + ADDRESS_OFFSET);
        }
    }

    /// @notice Utility function that converts the msg.sender viewed on L2 to the
    /// address that submitted a tx to the inbox on L1
    /// @param l2Address_ L2 address as viewed in msg.sender
    /// @return l1Address the address in the L1 that triggered the tx to L2
    function undoL1ToL2Alias(address l2Address_) internal pure returns (address l1Address) {
        unchecked {
            l1Address = address(uint160(l2Address_) - ADDRESS_OFFSET);
        }
    }

    /// @notice Validates that the sender address with applied zkSync's aliasing is equal to
    ///     the crossDomainAccount_ address
    modifier onlyFromCrossDomainAccount(address crossDomainAccount_) {
        if (msg.sender != applyL1ToL2Alias(crossDomainAccount_)) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    error ErrorWrongCrossDomainSender();
}
