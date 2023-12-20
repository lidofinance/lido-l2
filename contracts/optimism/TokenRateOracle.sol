// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";
// import { SafeCast } from "@openzeppelin/contracts-v4.4/utils/math/SafeCast.sol";

contract TokenRateOracle is ITokenRateOracle {

    /// Chain specification
    uint256 private immutable slotsPerEpoch;
    uint256 private immutable secondsPerSlot;
    uint256 private immutable genesisTime;
    uint256 private immutable initialEpoch;
    uint256 private immutable epochsPerFrame;

    error InvalidChainConfig();
    error InitialEpochRefSlotCannotBeEarlierThanProcessingSlot();
    error InitialEpochIsYetToArrive();

    int256 private tokenRate;
    uint8 private decimalsInAnswer;
    uint256 private rateL1Timestamp;
    uint80 private answeredInRound;

    constructor(
        uint256 slotsPerEpoch_,
        uint256 secondsPerSlot_,
        uint256 genesisTime_,
        uint256 initialEpoch_,
        uint256 epochsPerFrame_
    ) {
        if (slotsPerEpoch_ == 0) revert InvalidChainConfig();
        if (secondsPerSlot_ == 0) revert InvalidChainConfig();

        // Should I use toUint64();
        slotsPerEpoch = slotsPerEpoch_; 
        secondsPerSlot = secondsPerSlot_;
        genesisTime = genesisTime_;
        initialEpoch = initialEpoch_;
        epochsPerFrame = epochsPerFrame_;
    }
    
    /// @inheritdoc ITokenRateOracle
    /// @return roundId_ is reference slot of HashConsensus
    /// @return answer_ is wstETH/stETH token rate.
    /// @return startedAt_ is HashConsensus frame start.
    /// @return updatedAt_ is L2 timestamp of token rate update.
    /// @return answeredInRound_ is the round ID of the round in which the answer was computed
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        uint256 refSlot = _getRefSlot(initialEpoch, epochsPerFrame);
        uint80 roundId = uint80(refSlot);
        uint256 startedAt = _computeTimestampAtSlot(refSlot);

        return (
            roundId,
            tokenRate,
            startedAt,
            rateL1Timestamp,
            answeredInRound
        );
    }

    /// @inheritdoc ITokenRateOracle
    function latestAnswer() external view returns (int256) {
        return tokenRate;
    }

    /// @inheritdoc ITokenRateOracle
    function decimals() external view returns (uint8) {
        return decimalsInAnswer;
    }

    /// @inheritdoc ITokenRateOracle
    function updateRate(int256 rate, uint256 rateL1Timestamp_) external {
        // check timestamp not late as current one.
        if (rateL1Timestamp_ < _getTime()) {
            return;
        }
        tokenRate = rate;
        rateL1Timestamp = rateL1Timestamp_;
        answeredInRound = 666;
        decimalsInAnswer = 10;
    }

    /// Frame utilities

    function _getTime() internal virtual view returns (uint256) {
        return block.timestamp; // solhint-disable-line not-rely-on-time
    }

    function _getRefSlot(uint256 initialEpoch_, uint256 epochsPerFrame_) internal view returns (uint256) {
        return _getRefSlotAtTimestamp(_getTime(), initialEpoch_, epochsPerFrame_);
    }

    function _getRefSlotAtTimestamp(uint256 timestamp_, uint256 initialEpoch_, uint256 epochsPerFrame_)
        internal view returns (uint256)
    {
        return _getRefSlotAtIndex(_computeFrameIndex(timestamp_, initialEpoch_, epochsPerFrame_), initialEpoch_, epochsPerFrame_);
    }

    function _getRefSlotAtIndex(uint256 frameIndex_, uint256 initialEpoch_, uint256 epochsPerFrame_)
        internal view returns (uint256)
    {
        uint256 frameStartEpoch = _computeStartEpochOfFrameWithIndex(frameIndex_, initialEpoch_, epochsPerFrame_);
        uint256 frameStartSlot = _computeStartSlotAtEpoch(frameStartEpoch);
        return uint64(frameStartSlot - 1);
    }

    function _computeStartSlotAtEpoch(uint256 epoch_) internal view returns (uint256) {
        // See: github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#compute_start_slot_at_epoch
        return epoch_ * slotsPerEpoch;
    }

    function _computeStartEpochOfFrameWithIndex(uint256 frameIndex_, uint256 initialEpoch_, uint256 epochsPerFrame_)
        internal pure returns (uint256)
    {
        return initialEpoch_ + frameIndex_ * epochsPerFrame_;
    }

    function _computeFrameIndex(
        uint256 timestamp_,
        uint256 initialEpoch_,
        uint256 epochsPerFrame_
    )   internal view returns (uint256)
    {
        uint256 epoch = _computeEpochAtTimestamp(timestamp_);
        if (epoch < initialEpoch_) {
            revert InitialEpochIsYetToArrive();
        }
        return (epoch - initialEpoch_) / epochsPerFrame_;
    }

    function _computeEpochAtTimestamp(uint256 timestamp_) internal view returns (uint256) {
        return _computeEpochAtSlot(_computeSlotAtTimestamp(timestamp_));
    }

    function _computeEpochAtSlot(uint256 slot_) internal view returns (uint256) {
        // See: github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#compute_epoch_at_slot
        return slot_ / slotsPerEpoch;
    }

    function _computeSlotAtTimestamp(uint256 timestamp_) internal view returns (uint256) {
        return (timestamp_ - genesisTime) / secondsPerSlot;
    }

    function _computeTimestampAtSlot(uint256 slot_) internal view returns (uint256) {
        // See: github.com/ethereum/consensus-specs/blob/dev/specs/bellatrix/beacon-chain.md#compute_timestamp_at_slot
        return genesisTime + slot_ * secondsPerSlot;
    }
}