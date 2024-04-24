// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {L1ERC20ExtendedTokensBridge} from "./L1ERC20ExtendedTokensBridge.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author kovalgek
/// @notice A subset of wstETH token interface of core LIDO protocol.
interface IERC20WstETH {
    /// @notice Get amount of wstETH for a one stETH
    /// @return Amount of wstETH for a 1 stETH
    function stEthPerToken() external view returns (uint256);
}

/// @author kovalgek
/// @notice Hides wstETH concept from other contracts to keep `L1ERC20ExtendedTokensBridge` reusable.
contract L1LidoTokensBridge is L1ERC20ExtendedTokensBridge, Versioned {

    /// @param messenger_ L1 messenger address being used for cross-chain communications
    /// @param l2TokenBridge_ Address of the corresponding L2 bridge
    /// @param l1TokenNonRebasable_ Address of the bridged token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the token minted on the L2 chain when token bridged
    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) L1ERC20ExtendedTokensBridge(
        messenger_,
        l2TokenBridge_,
        l1TokenNonRebasable_,
        l1TokenRebasable_,
        l2TokenNonRebasable_,
        l2TokenRebasable_
    ) {
    }

    /// @notice Initializes the contract from scratch.
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function initialize(address admin_) external {
        _initializeContractVersionTo(2);
        _initializeBridgingManager(admin_);
    }

    /// @notice A function to finalize upgrade to v2 (from v1).
    function finalizeUpgrade_v2() external {
        if(!_isBridgingManagerInitialized()) {
            revert ErrorBridgingManagerIsNotInitialized();
        }
        _initializeContractVersionTo(2);
    }

    function _tokenRate() override internal view returns (uint256) {
        return IERC20WstETH(L1_TOKEN_NON_REBASABLE).stEthPerToken();
    }
}
