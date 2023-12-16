// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author psirex
/// @notice Contains the logic for validation of tokens used in the bridging process
contract BridgeableTokensOptimism {
    /// @notice Address of the bridged non rebasable token in the L1 chain
    address public immutable l1TokenNonRebasable;

    /// @notice Address of the bridged rebasable token in the L1 chain
    address public immutable l1TokenRebasable;

    /// @notice Address of the non rebasable token minted on the L2 chain when token bridged
    address public immutable l2TokenNonRebasable;

    /// @notice Address of the rebasable token minted on the L2 chain when token bridged
    address public immutable l2TokenRebasable;

    /// @param l1TokenNonRebasable_ Address of the bridged non rebasable token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged rebasable token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the non rebasable token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the rebasable token minted on the L2 chain when token bridged
    constructor(address l1TokenNonRebasable_, address l1TokenRebasable_, address l2TokenNonRebasable_, address l2TokenRebasable_) {
        l1TokenNonRebasable = l1TokenNonRebasable_;
        l1TokenRebasable = l1TokenRebasable_;
        l2TokenNonRebasable = l2TokenNonRebasable_;
        l2TokenRebasable = l2TokenRebasable_;
    }

    /// @dev Validates that passed l1Token_ is supported by the bridge
    modifier onlySupportedL1Token(address l1Token_) {
        if (l1Token_ != l1TokenNonRebasable && l1Token_ != l1TokenRebasable) {
            revert ErrorUnsupportedL1Token();
        }
        _;
    }

    /// @dev Validates that passed l2Token_ is supported by the bridge
    modifier onlySupportedL2Token(address l2Token_) {
        if (l2Token_ != l2TokenNonRebasable && l2Token_ != l2TokenRebasable) {
            revert ErrorUnsupportedL2Token();
        }
        _;
    }

    /// @dev validates that account_ is not zero address
    modifier onlyNonZeroAccount(address account_) {
        if (account_ == address(0)) {
            revert ErrorAccountIsZeroAddress();
        }
        _;
    }

    function isRebasableTokenFlow(address l1Token_, address l2Token_) internal view returns (bool) {
        return l1Token_ == l1TokenRebasable && l2Token_ == l2TokenRebasable;
    }

    function isNonRebasableTokenFlow(address l1Token_, address l2Token_) internal view returns (bool) {
        return l1Token_ == l1TokenNonRebasable && l2Token_ == l2TokenNonRebasable;
    }

    error ErrorUnsupportedL1Token();
    error ErrorUnsupportedL2Token();
    error ErrorAccountIsZeroAddress();
}
