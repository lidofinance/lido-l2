// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateUpdatable} from "./interfaces/ITokenRateUpdatable.sol";
import {IChainlinkAggregatorInterface} from "./interfaces/IChainlinkAggregatorInterface.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

interface ITokenRateOracle is ITokenRateUpdatable, IChainlinkAggregatorInterface {}

/// @author kovalgek
/// @notice Oracle for storing token rate.
contract TokenRateOracle is CrossDomainEnabled, ITokenRateOracle {

    /// @dev Stores the dynamic data of the oracle. Allows safely use of this
    ///     contract with upgradable proxies
    struct TokenRateData {
        /// @notice wstETH/stETH token rate.
        uint192 tokenRate;
        /// @notice L1 time when token rate was pushed.
        uint64 rateL1Timestamp;
    } // occupy a single slot

    /// @dev Location of the slot with TokenRateData
    bytes32 private constant TOKEN_RATE_DATA_SLOT =
        keccak256("TokenRateOracle.TOKEN_RATE_DATA_SLOT");

    /// @notice A bridge which can update oracle.
    address public immutable L2_ERC20_TOKEN_BRIDGE;

    /// @notice An address of account on L1 that can update token rate.
    address public immutable L1_TOKEN_RATE_PUSHER;

    /// @notice A time period when token rate can be considered outdated.
    uint256 public immutable TOKEN_RATE_OUTDATED_DELAY;

    /// @notice Decimals of the oracle response.
    uint8 public constant DECIMALS = 18;

    /// @notice The minimum value that the token rate can be
    uint256 public constant MIN_TOKEN_RATE = 1_000_000_000_000_000;         // 0.001

    /// @notice The maximum value that the token rate can be.
    uint256 public constant MAX_TOKEN_RATE = 1_000_000_000_000_000_000_000; // 1000

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l2ERC20TokenBridge_ the bridge address that has a right to updates oracle.
    /// @param l1TokenRatePusher_ An address of account on L1 that can update token rate.
    /// @param tokenRateOutdatedDelay_ time period when token rate can be considered outdated.
    constructor(
        address messenger_,
        address l2ERC20TokenBridge_,
        address l1TokenRatePusher_,
        uint256 tokenRateOutdatedDelay_
    ) CrossDomainEnabled(messenger_) {
        L2_ERC20_TOKEN_BRIDGE = l2ERC20TokenBridge_;
        L1_TOKEN_RATE_PUSHER = l1TokenRatePusher_;
        TOKEN_RATE_OUTDATED_DELAY = tokenRateOutdatedDelay_;
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        uint80 roundId = uint80(_loadTokenRateData().rateL1Timestamp);

        return (
            roundId,
            int256(uint(_loadTokenRateData().tokenRate)),
            _loadTokenRateData().rateL1Timestamp,
            _loadTokenRateData().rateL1Timestamp,
            roundId
        );
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestAnswer() external view returns (int256) {
        return int256(uint(_loadTokenRateData().tokenRate));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateUpdatable
    function updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) external {

        if (!_isAuthorized(msg.sender)) {
            revert ErrorNoRights(msg.sender);
        }

        if (rateL1Timestamp_ < _loadTokenRateData().rateL1Timestamp) {
            emit NewTokenRateOutdated(tokenRate_, _loadTokenRateData().rateL1Timestamp, rateL1Timestamp_);
            return;
        }

        if (rateL1Timestamp_ > block.timestamp) {
            revert ErrorL1TimestampInFuture(tokenRate_, rateL1Timestamp_);
        }

        if (tokenRate_ < MIN_TOKEN_RATE || tokenRate_ > MAX_TOKEN_RATE) {
            revert ErrorTokenRateIsOutOfRange(tokenRate_, rateL1Timestamp_);
        }

        if (tokenRate_ == _loadTokenRateData().tokenRate && rateL1Timestamp_ == _loadTokenRateData().rateL1Timestamp) {
            return;
        }

        _loadTokenRateData().tokenRate = uint192(tokenRate_);
        _loadTokenRateData().rateL1Timestamp = uint64(rateL1Timestamp_);

        emit RateUpdated(_loadTokenRateData().tokenRate, _loadTokenRateData().rateL1Timestamp);
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp - _loadTokenRateData().rateL1Timestamp > TOKEN_RATE_OUTDATED_DELAY;
    }

    function _isAuthorized(address caller_) internal view returns (bool) {
        bool isCalledFromL1TokenRatePusher = caller_ == address(MESSENGER) &&
            MESSENGER.xDomainMessageSender() == L1_TOKEN_RATE_PUSHER;
        bool isCalledFromERC20TokenRateBridge = caller_ == L2_ERC20_TOKEN_BRIDGE;
        return isCalledFromL1TokenRatePusher || isCalledFromERC20TokenRateBridge;
    }

    /// @dev Returns the reference to the slot with TokenRateData struct
    function _loadTokenRateData()
        private
        pure
        returns (TokenRateData storage r)
    {
        bytes32 slot = TOKEN_RATE_DATA_SLOT;
        assembly {
            r.slot := slot
        }
    }

    event RateUpdated(uint256 tokenRate_, uint256 rateL1Timestamp_);
    event NewTokenRateOutdated(uint256 tokenRate_, uint256 rateL1Timestamp_, uint256 newTateL1Timestamp_);

    error ErrorNoRights(address caller);
    error ErrorL1TimestampInFuture(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorTokenRateIsOutOfRange(uint256 tokenRate_, uint256 rateL1Timestamp_);
}
