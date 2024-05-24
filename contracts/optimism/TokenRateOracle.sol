// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateUpdatable} from "./interfaces/ITokenRateUpdatable.sol";
import {IChainlinkAggregatorInterface} from "./interfaces/IChainlinkAggregatorInterface.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {Versioned} from "../utils/Versioned.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface ITokenRateOracle is ITokenRateUpdatable, IChainlinkAggregatorInterface {}

/// @author kovalgek
/// @notice Oracle for storing and providing token rate.
///         NB: Cross-chain apps and CEXes should fetch the token rate specific to the chain for deposits/withdrawals
///         and compare against the token rate on L1 being a source of truth;
/// @dev Token rate updates can be delivered from two sources: L1 token rate pusher and L2 bridge.
contract TokenRateOracle is CrossDomainEnabled, ITokenRateOracle, Versioned {

    /// @dev Stores the dynamic data of the oracle. Allows safely use of this
    ///     contract with upgradable proxies
    struct TokenRateData {
        /// @notice wstETH/stETH token rate.
        uint128 tokenRate;
        /// @notice last time when token rate was updated on L1.
        uint64 rateUpdateL1Timestamp;
        /// @notice last time when token rate was received on L2.
        uint64 rateReceivedL2Timestamp;
    } // occupies a single slot

    /// @notice A bridge which can update oracle.
    address public immutable L2_ERC20_TOKEN_BRIDGE;

    /// @notice An address of account on L1 that can update token rate.
    address public immutable L1_TOKEN_RATE_PUSHER;

    /// @notice A time period when token rate can be considered outdated.
    uint256 public immutable TOKEN_RATE_OUTDATED_DELAY;

    /// @notice A time difference between received l1Timestamp and L2 block.timestamp
    ///         when token rate can be considered outdated.
    uint256 public immutable MAX_ALLOWED_L2_TO_L1_CLOCK_LAG;

    /// @notice Allowed token rate deviation per day in basic points.
    uint256 public immutable MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY;

    /// @notice Number of seconds in one day.
    uint256 public constant ONE_DAY_SECONDS = 86400;

    /// @notice Decimals of the oracle response.
    uint8 public constant DECIMALS = 27;

    /// @notice Max allowed token rate value.
    uint256 public constant MAX_ALLOWED_TOKEN_RATE = 10 ** (DECIMALS + 2);

    /// @notice Min allowed token rate value.
    uint256 public constant MIN_ALLOWED_TOKEN_RATE = 10 ** (DECIMALS - 2);

    /// @notice Basic point scale.
    uint256 private constant BASIS_POINT_SCALE = 1e4;

    /// @dev Location of the slot with TokenRateData
    bytes32 private constant TOKEN_RATE_DATA_SLOT = keccak256("TokenRateOracle.TOKEN_RATE_DATA_SLOT");

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l2ERC20TokenBridge_ the bridge address that has a right to updates oracle.
    /// @param l1TokenRatePusher_ An address of account on L1 that can update token rate.
    /// @param tokenRateOutdatedDelay_ time period when token rate can be considered outdated.
    /// @param maxAllowedL2ToL1ClockLag_ A time difference between received l1Timestamp and L2 block.timestamp
    ///         when token rate can be considered outdated.
    /// @param maxAllowedTokenRateDeviationPerDay_ Allowed token rate deviation per day in basic points.
    ///        Can't be bigger than BASIS_POINT_SCALE.
    constructor(
        address messenger_,
        address l2ERC20TokenBridge_,
        address l1TokenRatePusher_,
        uint256 tokenRateOutdatedDelay_,
        uint256 maxAllowedL2ToL1ClockLag_,
        uint256 maxAllowedTokenRateDeviationPerDay_
    ) CrossDomainEnabled(messenger_) {
        if (l2ERC20TokenBridge_ == address(0)) {
            revert ErrorZeroAddressL2ERC20TokenBridge();
        }
        if (l1TokenRatePusher_ == address(0)) {
            revert ErrorZeroAddressL1TokenRatePusher();
        }
        if (maxAllowedTokenRateDeviationPerDay_ > BASIS_POINT_SCALE) {
            revert ErrorMaxTokenRateDeviationIsOutOfRange();
        }
        L2_ERC20_TOKEN_BRIDGE = l2ERC20TokenBridge_;
        L1_TOKEN_RATE_PUSHER = l1TokenRatePusher_;
        TOKEN_RATE_OUTDATED_DELAY = tokenRateOutdatedDelay_;
        MAX_ALLOWED_L2_TO_L1_CLOCK_LAG = maxAllowedL2ToL1ClockLag_;
        MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY = maxAllowedTokenRateDeviationPerDay_;
    }

    function initialize(uint256 tokenRate_, uint256 rateL1Timestamp_) external {
        if (tokenRate_ < MIN_ALLOWED_TOKEN_RATE || tokenRate_ > MAX_ALLOWED_TOKEN_RATE) {
            revert ErrorTokenRateInitializationIsOutOfAllowedRange(tokenRate_);
        }
        if (rateL1Timestamp_ > block.timestamp + MAX_ALLOWED_L2_TO_L1_CLOCK_LAG) {
            revert ErrorL1TimestampInitializationIsOutOfAllowedRange(rateL1Timestamp_);
        }
        _initializeContractVersionTo(1);
        _setTokenRateAndTimestamps(uint128(tokenRate_), uint64(rateL1Timestamp_));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        TokenRateData memory tokenRateData = _getTokenRateAndTimestamps();

        return (
            uint80(tokenRateData.rateUpdateL1Timestamp),
            int256(uint256(tokenRateData.tokenRate)),
            tokenRateData.rateUpdateL1Timestamp,
            tokenRateData.rateReceivedL2Timestamp,
            uint80(tokenRateData.rateUpdateL1Timestamp)
        );
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestAnswer() external view returns (int256) {
        return int256(uint256(_loadTokenRateData().value.tokenRate));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateUpdatable
    function updateRate(uint256 tokenRate_, uint256 rateUpdateL1Timestamp_) external onlyBridgeOrTokenRatePusher {
        TokenRateData memory tokenRateData = _getTokenRateAndTimestamps();

        /// @dev checks if the clock lag (i.e, time difference) between L1 and L2 exceeds the configurable threshold
        if (rateUpdateL1Timestamp_ > block.timestamp + MAX_ALLOWED_L2_TO_L1_CLOCK_LAG) {
            revert ErrorL1TimestampExceededAllowedClockLag(tokenRate_, rateUpdateL1Timestamp_);
        }

        /// @dev Use only the most up-to-date token rate. Reverting should be avoided as it may occur occasionally.
        if (rateUpdateL1Timestamp_ < tokenRateData.rateUpdateL1Timestamp) {
            emit DormantTokenRateUpdateIgnored(rateUpdateL1Timestamp_, tokenRateData.rateUpdateL1Timestamp);
            return;
        }

        /// @dev Bump L2 receipt time, don't touch the rate othwerwise
        /// NB: Here we assume that the rate can only be changed together with the token rebase induced
        /// by the AccountingOracle report
        if (rateUpdateL1Timestamp_ == tokenRateData.rateUpdateL1Timestamp) {
            _loadTokenRateData().value.rateReceivedL2Timestamp = uint64(block.timestamp);
            emit RateReceivedTimestampUpdated(block.timestamp);
            return;
        }

        /// @dev allow token rate to be within some configurable range that depens on time it wasn't updated.
        if ((tokenRate_ != tokenRateData.tokenRate) && !_isTokenRateWithinAllowedRange(
                tokenRateData.tokenRate,
                tokenRate_,
                tokenRateData.rateUpdateL1Timestamp,
                rateUpdateL1Timestamp_)
            ) {
            revert ErrorTokenRateIsOutOfRange(tokenRate_, rateUpdateL1Timestamp_);
        }

        /// @dev notify that there is a differnce L1 and L2 time.
        if (rateUpdateL1Timestamp_ > block.timestamp) {
            emit TokenRateL1TimestampIsInFuture(tokenRate_, rateUpdateL1Timestamp_);
        }

        _setTokenRateAndTimestamps(uint128(tokenRate_), uint64(rateUpdateL1Timestamp_));

        emit RateUpdated(tokenRate_, rateUpdateL1Timestamp_);
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp > _loadTokenRateData().value.rateReceivedL2Timestamp + TOKEN_RATE_OUTDATED_DELAY;
    }

    /// @notice Allow tokenRate deviation from the previous value to be
    ///         ±`MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY` BP per day.
    function _isTokenRateWithinAllowedRange(
        uint256 currentTokenRate_,
        uint256 newTokenRate_,
        uint256 currentRateL1Timestamp_,
        uint256 newRateL1Timestamp_
    ) internal view returns (bool) {
        uint256 allowedTokenRateDeviation = _allowedTokenRateDeviation(newRateL1Timestamp_, currentRateL1Timestamp_);
        return newTokenRate_ <= _maxTokenRateLimit(currentTokenRate_, allowedTokenRateDeviation) &&
               newTokenRate_ >= _minTokenRateLimit(currentTokenRate_, allowedTokenRateDeviation);
    }

    /// @dev Returns the allowed token deviation depending on the number of days passed since the last update.
    function _allowedTokenRateDeviation(
        uint256 newRateL1Timestamp_,
        uint256 currentRateL1Timestamp_
    ) internal view returns (uint256) {
        uint256 rateL1TimestampDiff = newRateL1Timestamp_ - currentRateL1Timestamp_;
        uint256 roundedUpNumberOfDays = (rateL1TimestampDiff + ONE_DAY_SECONDS - 1) / ONE_DAY_SECONDS;
        return roundedUpNumberOfDays * MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY;
    }

    /// @dev Returns the maximum allowable value for the token rate.
    function _maxTokenRateLimit(
        uint256 currentTokenRate,
        uint256 allowedTokenRateDeviation
    ) internal pure returns (uint256) {
        uint256 maxTokenRateLimit = currentTokenRate * (BASIS_POINT_SCALE + allowedTokenRateDeviation) /
            BASIS_POINT_SCALE;
        return Math.min(maxTokenRateLimit, MAX_ALLOWED_TOKEN_RATE);
    }

    /// @dev Returns the minimum allowable value for the token rate.
    function _minTokenRateLimit(
        uint256 currentTokenRate,
        uint256 allowedTokenRateDeviation
    ) internal pure returns (uint256) {
        uint256 minTokenRateLimit = MIN_ALLOWED_TOKEN_RATE;
        if (allowedTokenRateDeviation <= BASIS_POINT_SCALE) {
            minTokenRateLimit = (currentTokenRate * (BASIS_POINT_SCALE - allowedTokenRateDeviation) /
            BASIS_POINT_SCALE);
        }
        return Math.max(minTokenRateLimit, MIN_ALLOWED_TOKEN_RATE);
    }

    function _isCallerBridgeOrMessengerWithTokenRatePusher(address caller_) internal view returns (bool) {
        if (caller_ == L2_ERC20_TOKEN_BRIDGE) {
            return true;
        }
        if (caller_ == address(MESSENGER) && MESSENGER.xDomainMessageSender() == L1_TOKEN_RATE_PUSHER) {
            return true;
        }
        return false;
    }

    function _setTokenRateAndTimestamps(uint128 tokenRate_, uint64 rateUpdateL1Timestamp_) internal {
        _loadTokenRateData().value = TokenRateData(tokenRate_, rateUpdateL1Timestamp_, uint64(block.timestamp));
    }

    function _getTokenRateAndTimestamps() private view returns (TokenRateData memory tokenRateData) {
        tokenRateData = _loadTokenRateData().value;
    }

    /// @dev Storage helper for TokenRateData
    struct StorageTokenRateData {
        TokenRateData value;
    }

    /// @dev Returns the reference to the slot with TokenRateData struct
    function _loadTokenRateData()
        private
        pure
        returns (StorageTokenRateData storage r)
    {
        bytes32 slot = TOKEN_RATE_DATA_SLOT;
        assembly {
            r.slot := slot
        }
    }

    modifier onlyBridgeOrTokenRatePusher() {
        if (!_isCallerBridgeOrMessengerWithTokenRatePusher(msg.sender)) {
            revert ErrorNotBridgeOrTokenRatePusher();
        }
        _;
    }

    event RateUpdated(uint256 tokenRate_, uint256 indexed rateL1Timestamp_);
    event RateReceivedTimestampUpdated(uint256 indexed rateReceivedL2Timestamp);
    event DormantTokenRateUpdateIgnored(uint256 indexed newRateL1Timestamp_, uint256 indexed currentRateL1Timestamp_);
    event TokenRateL1TimestampIsInFuture(uint256 tokenRate_, uint256 indexed rateL1Timestamp_);

    error ErrorZeroAddressL2ERC20TokenBridge();
    error ErrorZeroAddressL1TokenRatePusher();
    error ErrorNotBridgeOrTokenRatePusher();
    error ErrorL1TimestampExceededAllowedClockLag(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorTokenRateIsOutOfRange(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorMaxTokenRateDeviationIsOutOfRange();
    error ErrorTokenRateInitializationIsOutOfAllowedRange(uint256 tokenRate_);
    error ErrorL1TimestampInitializationIsOutOfAllowedRange(uint256 rateL1Timestamp_);
}
