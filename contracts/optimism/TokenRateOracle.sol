// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";

/// @author kovalgek
/// @notice Oracle for storing token rate.
contract TokenRateOracle is ITokenRateOracle {

    error NotAnOwner(address caller);
    error IncorrectRateTimestamp();

    /// @notice wstETH/stETH token rate.
    uint256 private tokenRate;

    /// @notice L1 time when token rate was pushed. 
    uint256 private rateL1Timestamp;

    /// @notice A bridge which can update oracle.
    address public immutable bridge;

    /// @notice An updater which can update oracle.
    address public immutable tokenRateUpdater;

    /// @param bridge_ the bridge address that has a right to updates oracle.
    /// @param tokenRateUpdater_ address of oracle updater that has a right to updates oracle.
    constructor(address bridge_, address tokenRateUpdater_) {
        bridge = bridge_;
        tokenRateUpdater = tokenRateUpdater_;
    }

    /// @inheritdoc ITokenRateOracle
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        uint80 roundId = uint80(rateL1Timestamp); // TODO: add solt

        return (
            roundId,
            int256(tokenRate),
            rateL1Timestamp,
            rateL1Timestamp,
            roundId
        );
    }

    /// @inheritdoc ITokenRateOracle
    function latestAnswer() external view returns (int256) {
        return int256(tokenRate);
    }

    /// @inheritdoc ITokenRateOracle
    function decimals() external pure returns (uint8) {
        return 18;
    }

    /// @inheritdoc ITokenRateOracle
    function updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) external onlyOwner {
        // reject rates from the future
        if (rateL1Timestamp_ < rateL1Timestamp) {
            revert IncorrectRateTimestamp();
        }
        tokenRate = tokenRate_;
        rateL1Timestamp = rateL1Timestamp_;
    }

    /// @dev validates that method called by one of the owners
    modifier onlyOwner() {
        if (msg.sender != bridge && msg.sender != tokenRateUpdater) {
            revert NotAnOwner(msg.sender);
        }
        _;
    }
}