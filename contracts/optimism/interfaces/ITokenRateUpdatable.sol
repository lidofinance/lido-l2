// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice An interface for updating token rate of token rate oracle.
interface ITokenRateUpdatable {
    /// @notice Updates token rate.
    /// @param tokenRate_ wstETH/stETH token rate.
    /// @param rateUpdatedL1Timestamp_ L1 time when rate was updated on L1 side.
    function updateRate(uint256 tokenRate_, uint256 rateUpdatedL1Timestamp_) external;
}
