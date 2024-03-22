// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

/// @author kovalgek
/// @notice Oracle for storing token rate.
contract TokenRateOracle is CrossDomainEnabled, ITokenRateOracle {

    /// @notice A bridge which can update oracle.
    address public immutable BRIDGE;

    /// @notice An address of account on L1 that can update token rate.
    address public immutable L1_TOKEN_RATE_PUSHER;

    /// @notice A time period when token rate can be considered outdated.
    uint256 public immutable RATE_OUTDATED_DELAY;

    /// @notice wstETH/stETH token rate.
    uint256 private tokenRate;

    /// @notice L1 time when token rate was pushed.
    uint256 private rateL1Timestamp;

    /// @notice Decimals of the oracle response.
    uint8 private constant DECIMALS = 18;

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param bridge_ the bridge address that has a right to updates oracle.
    /// @param l1TokenRatePusher_ An address of account on L1 that can update token rate.
    /// @param rateOutdatedDelay_ time period when token rate can be considered outdated.
    constructor(
        address messenger_,
        address bridge_,
        address l1TokenRatePusher_,
        uint256 rateOutdatedDelay_
    ) CrossDomainEnabled(messenger_) {
        BRIDGE = bridge_;
        L1_TOKEN_RATE_PUSHER = l1TokenRatePusher_;
        RATE_OUTDATED_DELAY = rateOutdatedDelay_;
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
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateOracle
    function updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) external {

        if ((msg.sender != address(MESSENGER) || MESSENGER.xDomainMessageSender() != L1_TOKEN_RATE_PUSHER) &&
             msg.sender != BRIDGE) {
            revert ErrorNoRights(msg.sender);
        }

        if (rateL1Timestamp_ < rateL1Timestamp) {
            revert ErrorIncorrectRateTimestamp();
        }

        if (tokenRate_ == tokenRate && rateL1Timestamp_ == rateL1Timestamp) {
            return;
        }

        tokenRate = tokenRate_;
        rateL1Timestamp = rateL1Timestamp_;

        emit RateUpdated(tokenRate, rateL1Timestamp);
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp - rateL1Timestamp > RATE_OUTDATED_DELAY;
    }

    event RateUpdated(uint256 tokenRate_, uint256 rateL1Timestamp_);

    error ErrorNoRights(address caller);
    error ErrorIncorrectRateTimestamp();
}
