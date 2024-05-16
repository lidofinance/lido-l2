// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {L1ERC20ExtendedTokensBridge} from "./L1ERC20ExtendedTokensBridge.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author kovalgek
/// @notice A subset of wstETH token interface of core LIDO protocol.
interface IERC20WstETH {
    /// @notice Get amount of stETH for the givern amount of wstETH
    /// @return Amount of stETH
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
}

/// @author dzhon
/// @notice A subset of AccountingOracle interface of core LIDO protocol.
interface IAccountingOracle {
    /// @notice Get timetamp of the Consensus Layer genesis
    function GENESIS_TIME() external view returns (uint256);
    /// @notice Get seconds per single Consensus Layer slot
    function SECONDS_PER_SLOT() external view returns (uint256);
    /// @notice Returns the last reference slot for which processing of the report was started
    function getLastProcessingRefSlot() external view returns (uint256);
}

/// @author kovalgek
/// @notice Hides wstETH concept from other contracts to keep `L1ERC20ExtendedTokensBridge` reusable.
contract L1LidoTokensBridge is L1ERC20ExtendedTokensBridge, Versioned {

    /// @notice Timetamp of the Consensus Layer genesis
    uint256 public immutable GENESIS_TIME;

    /// @notice Seconds per single Consensus Layer slot
    uint256 public immutable SECONDS_PER_SLOT;

    /// @notice Address of the AccountingOracle instance
    address public immutable ACCOUNTING_ORACLE;

    /// @notice Token rate decimals to push
    uint256 public constant TOKEN_RATE_DECIMALS = 27;

    /// @param messenger_ L1 messenger address being used for cross-chain communications
    /// @param l2TokenBridge_ Address of the corresponding L2 bridge
    /// @param l1TokenNonRebasable_ Address of the bridged token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the token minted on the L2 chain when token bridged
    /// @param accountingOracle_ Address of the AccountingOracle instance to retrieve rate update timestamps
    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_,
        address accountingOracle_
    ) L1ERC20ExtendedTokensBridge(
        messenger_,
        l2TokenBridge_,
        l1TokenNonRebasable_,
        l1TokenRebasable_,
        l2TokenNonRebasable_,
        l2TokenRebasable_
    ) {
        ACCOUNTING_ORACLE = accountingOracle_;
        GENESIS_TIME = IAccountingOracle(ACCOUNTING_ORACLE).GENESIS_TIME();
        SECONDS_PER_SLOT = IAccountingOracle(ACCOUNTING_ORACLE).SECONDS_PER_SLOT();
    }

    /// @notice Initializes the contract from scratch.
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function initialize(address admin_) external {
        _initializeContractVersionTo(2);
        _initializeBridgingManager(admin_);
    }

    /// @notice A function to finalize upgrade to v2 (from v1).
    function finalizeUpgrade_v2() external {
        if (!_isBridgingManagerInitialized()) {
            revert ErrorBridgingManagerIsNotInitialized();
        }
        _initializeContractVersionTo(2);
    }

    function tokenRate() override public view returns (uint256 rate, uint256 updateTimestamp) {
        rate = IERC20WstETH(L1_TOKEN_NON_REBASABLE).getStETHByWstETH(10 ** TOKEN_RATE_DECIMALS);

        updateTimestamp = GENESIS_TIME + SECONDS_PER_SLOT * IAccountingOracle(
            ACCOUNTING_ORACLE
        ).getLastProcessingRefSlot();
    }
}
