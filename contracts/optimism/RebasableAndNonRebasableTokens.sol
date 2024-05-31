// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author psirex, kovalgek
/// @notice Contains the logic for validation of tokens used in the bridging process
contract RebasableAndNonRebasableTokens {

    /// @notice Address of the bridged non rebasable token in the L1 chain
    address public immutable L1_TOKEN_NON_REBASABLE;

    /// @notice Address of the bridged rebasable token in the L1 chain
    address public immutable L1_TOKEN_REBASABLE;

    /// @notice Address of the non rebasable token minted on the L2 chain when token bridged
    address public immutable L2_TOKEN_NON_REBASABLE;

    /// @notice Address of the rebasable token minted on the L2 chain when token bridged
    address public immutable L2_TOKEN_REBASABLE;

    /// @param l1TokenNonRebasable_ Address of the bridged non rebasable token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged rebasable token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the non rebasable token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the rebasable token minted on the L2 chain when token bridged
    constructor(
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) {
        if (l1TokenNonRebasable_ == address(0)) {
            revert ErrorZeroAddressL1TokenNonRebasable();
        }
        if (l1TokenRebasable_ == address(0)) {
            revert ErrorZeroAddressL1TokenRebasable();
        }
        if (l2TokenNonRebasable_ == address(0)) {
            revert ErrorZeroAddressL2TokenNonRebasable();
        }
        if (l2TokenRebasable_ == address(0)) {
            revert ErrorZeroAddressL2TokenRebasable();
        }
        L1_TOKEN_NON_REBASABLE = l1TokenNonRebasable_;
        L1_TOKEN_REBASABLE = l1TokenRebasable_;
        L2_TOKEN_NON_REBASABLE = l2TokenNonRebasable_;
        L2_TOKEN_REBASABLE = l2TokenRebasable_;
    }

    function _isSupportedL1L2TokensPair(address l1Token_, address l2Token_) internal view returns (bool) {
        bool isNonRebasablePair = l1Token_ == L1_TOKEN_NON_REBASABLE && l2Token_ == L2_TOKEN_NON_REBASABLE;
        bool isRebasablePair = l1Token_ == L1_TOKEN_REBASABLE && l2Token_ == L2_TOKEN_REBASABLE;
        return isNonRebasablePair || isRebasablePair;
    }

    function _getL1Token(address l2Token_) internal view returns (address) {
        if (l2Token_ == L2_TOKEN_NON_REBASABLE) { return L1_TOKEN_NON_REBASABLE; }
        if (l2Token_ == L2_TOKEN_REBASABLE) { return L1_TOKEN_REBASABLE; }
        revert ErrorUnsupportedL2Token(l2Token_);
    }

    /// @dev Validates that passed l1Token_ and l2Token_ tokens pair is supported by the bridge.
    modifier onlySupportedL1L2TokensPair(address l1Token_, address l2Token_) {
        if (!_isSupportedL1L2TokensPair(l1Token_, l2Token_)) {
            revert ErrorUnsupportedL1L2TokensPair(l1Token_, l2Token_);
        }
        _;
    }

    /// @dev Validates that passed l2Token_ is supported by the bridge
    modifier onlySupportedL2Token(address l2Token_) {
        if (l2Token_ != L2_TOKEN_NON_REBASABLE && l2Token_ != L2_TOKEN_REBASABLE) {
            revert ErrorUnsupportedL2Token(l2Token_);
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

    error ErrorZeroAddressL1TokenNonRebasable();
    error ErrorZeroAddressL1TokenRebasable();
    error ErrorZeroAddressL2TokenNonRebasable();
    error ErrorZeroAddressL2TokenRebasable();
    error ErrorUnsupportedL2Token(address l2Token);
    error ErrorUnsupportedL1L2TokensPair(address l1Token, address l2Token);
    error ErrorAccountIsZeroAddress();
}
