// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

/// @author psirex
/// @notice Contains the logic for validation of tokens used in the bridging process
contract BridgeableTokens {
    /// @notice An address of the bridged token in the L1 chain
    address public immutable l1Token;

    /// @notice An address of the token minted on the L2 chain when token bridged
    address public immutable l2Token;

    /// @param l1Token_ An address of the bridged token in the L1 chain
    /// @param l2Token_ An address of the token minted on the L2 chain when token bridged
    constructor(address l1Token_, address l2Token_) {
        l1Token = l1Token_;
        l2Token = l2Token_;
    }

    /// @notice Validate that passed l1Token_ is supported by the bridge
    modifier onlySupportedL1Token(address l1Token_) {
        if (l1Token_ != l1Token) {
            revert ErrorUnsupportedL1Token();
        }
        _;
    }

    /// @notice Validate that passed l2Token_ is supported by the bridge
    modifier onlySupportedL2Token(address l2Token_) {
        if (l2Token_ != l2Token) {
            revert ErrorUnsupportedL2Token();
        }
        _;
    }

    error ErrorUnsupportedL1Token();
    error ErrorUnsupportedL2Token();
}
