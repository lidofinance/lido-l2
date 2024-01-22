// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";

/// @author kovalgek
/// @notice Oracle for storing token rate.
contract TokenRateOracle is ITokenRateOracle {

    /// @notice wstETH/stETH token rate.
    uint256 private tokenRate;

    /// @notice L1 time when token rate was pushed.
    uint256 private rateL1Timestamp;

    /// @notice A bridge which can update oracle.
    address public immutable BRIDGE;

    /// @notice An updater which can update oracle.
    address public immutable TOKEN_RATE_UPDATER;

    /// @notice A time period when token rate can be considered outdated.
    uint256 public immutable RATE_VALIDITY_PERIOD;

    /// @param bridge_ the bridge address that has a right to updates oracle.
    /// @param tokenRateUpdater_ address of oracle updater that has a right to updates oracle.
    /// @param rateValidityPeriod_ time period when token rate can be considered outdated.
    constructor(address bridge_, address tokenRateUpdater_, uint256 rateValidityPeriod_) {
        BRIDGE = bridge_;
        TOKEN_RATE_UPDATER = tokenRateUpdater_;
        RATE_VALIDITY_PERIOD = rateValidityPeriod_;
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
            revert ErrorIncorrectRateTimestamp();
        }
        tokenRate = tokenRate_;
        rateL1Timestamp = rateL1Timestamp_;
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp - rateL1Timestamp > RATE_VALIDITY_PERIOD;
    }

    /// @dev validates that method called by one of the owners
    modifier onlyOwner() {
        if (msg.sender != BRIDGE && msg.sender != TOKEN_RATE_UPDATER) {
            revert ErrorNotAnOwner(msg.sender);
        }
        _;
    }

    error ErrorNotAnOwner(address caller);
    error ErrorIncorrectRateTimestamp();
}
