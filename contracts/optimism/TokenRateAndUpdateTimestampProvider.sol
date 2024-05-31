// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author dzhon
/// @notice A subset of AccountingOracle interface of core LIDO protocol.
interface IAccountingOracle {
    /// @notice Get timestamp of the Consensus Layer genesis
    function GENESIS_TIME() external view returns (uint256);
    /// @notice Get seconds per single Consensus Layer slot
    function SECONDS_PER_SLOT() external view returns (uint256);
    /// @notice Returns the last reference slot for which processing of the report was started
    function getLastProcessingRefSlot() external view returns (uint256);
}

/// @author kovalgek
/// @notice A subset of wstETH token interface of core LIDO protocol.
interface IERC20WstETH {
    /// @notice Get amount of stETH for a given amount of wstETH
    /// @param wstETHAmount_ amount of wstETH
    /// @return Amount of stETH for a given wstETH amount
    function getStETHByWstETH(uint256 wstETHAmount_) external view returns (uint256);
}

/// @author kovalgek
/// @notice Provides token rate and update timestamp.
abstract contract TokenRateAndUpdateTimestampProvider {

    /// @notice Non-rebasable token of Core Lido procotol.
    address public immutable WSTETH;

    /// @notice Address of the AccountingOracle instance
    address public immutable ACCOUNTING_ORACLE;

    /// @notice Timetamp of the Consensus Layer genesis
    uint256 public immutable GENESIS_TIME;

    /// @notice Seconds per single Consensus Layer slot
    uint256 public immutable SECONDS_PER_SLOT;

    /// @notice Token rate decimals to push
    uint256 public constant TOKEN_RATE_DECIMALS = 27;

    constructor(address wstETH_, address accountingOracle_) {
        if (wstETH_ == address(0)) {
            revert ErrorZeroAddressWstETH();
        }
        if (accountingOracle_ == address(0)) {
            revert ErrorZeroAddressAccountingOracle();
        }
        WSTETH = wstETH_;
        ACCOUNTING_ORACLE = accountingOracle_;
        GENESIS_TIME = IAccountingOracle(ACCOUNTING_ORACLE).GENESIS_TIME();
        SECONDS_PER_SLOT = IAccountingOracle(ACCOUNTING_ORACLE).SECONDS_PER_SLOT();
    }

    function _getTokenRateAndUpdateTimestamp() internal view returns (uint256 rate, uint256 updateTimestamp) {
        rate = IERC20WstETH(WSTETH).getStETHByWstETH(10 ** TOKEN_RATE_DECIMALS);

        /// @dev github.com/ethereum/consensus-specs/blob/dev/specs/bellatrix/beacon-chain.md#compute_timestamp_at_slot
        updateTimestamp = GENESIS_TIME + SECONDS_PER_SLOT * IAccountingOracle(
            ACCOUNTING_ORACLE
        ).getLastProcessingRefSlot();
    }

    error ErrorZeroAddressWstETH();
    error ErrorZeroAddressAccountingOracle();
}
