// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice Oracle interface for two tokens rate. A subset of Chainlink data feed interface.
interface ITokenRateOracle {

    /// @notice get data about the latest round.
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    /// @notice get answer about the latest round.
    function latestAnswer() external view returns (int256);

    /// @notice represents the number of decimals the oracle responses represent.
    function decimals() external view returns (uint8);

    /// @notice Updates token rate.
    function updateRate(int256 tokenRate_, uint256 rateL1Timestamp_, uint256 lastProcessingRefSlot_) external;
}