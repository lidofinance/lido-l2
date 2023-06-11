// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @notice Upgadeable variant of contract that contains the logic for validation of tokens used in the bridging process
contract BridgeableTokensUpgradable is Initializable {
    /// @notice Address of the bridged token in the L1 chain
    address public l1Token;

    /// @notice Address of the token minted on the L2 chain when token bridged
    address public l2Token;

    /// @param l1Token_ Address of the bridged token in the L1 chain
    /// @param l2Token_ Address of the token minted on the L2 chain when token bridged
    function __BridgeableTokens_init(address l1Token_, address l2Token_) internal onlyInitializing {
        l1Token = l1Token_;
        l2Token = l2Token_;
    }

    /// @dev Validates that passed l1Token_ is supported by the bridge
    modifier onlySupportedL1Token(address l1Token_) {
        if (l1Token_ != l1Token) {
            revert ErrorUnsupportedL1Token();
        }
        _;
    }

    /// @dev Validates that passed l2Token_ is supported by the bridge
    modifier onlySupportedL2Token(address l2Token_) {
        if (l2Token_ != l2Token) {
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

    error ErrorUnsupportedL1Token();
    error ErrorUnsupportedL2Token();
    error ErrorAccountIsZeroAddress();
}
