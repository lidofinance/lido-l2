// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateUpdatable} from "./interfaces/ITokenRateUpdatable.sol";
import {IChainlinkAggregatorInterface} from "./interfaces/IChainlinkAggregatorInterface.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {Versioned} from "../utils/Versioned.sol";

interface ITokenRateOracle is ITokenRateUpdatable, IChainlinkAggregatorInterface {}

/// @author kovalgek
/// @notice Oracle for storing token rate.
/// @dev Token rate updates can be delivered from two sources: L1 token rate pusher and L2 bridge.
contract TokenRateOracle is CrossDomainEnabled, ITokenRateOracle, Versioned {

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

    /// @notice A time difference between received l1Timestamp and L2 block.timestamp
    ///         when token rate can be considered outdated.
    uint256 public immutable MAX_ALLOWED_L2_TO_L1_CLOCK_LAG;

    /// @notice Allowed token rate deviation per day in basic points.
    uint256 public immutable MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY;

    /// @notice Number of seconds in one day.
    uint256 public constant ONE_DAY_SECONDS = 86400;

    /// @notice Decimals of the oracle response.
    uint8 public constant DECIMALS = 18;

    /// @notice Basic point scale.
    uint256 private constant BASIS_POINT_SCALE = 1e4;

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l2ERC20TokenBridge_ the bridge address that has a right to updates oracle.
    /// @param l1TokenRatePusher_ An address of account on L1 that can update token rate.
    /// @param tokenRateOutdatedDelay_ time period when token rate can be considered outdated.
    /// @param maxAllowedL2ToL1ClockLag_ A time difference between received l1Timestamp and L2 block.timestamp
    ///         when token rate can be considered outdated.
    /// @param maxAllowedTokenRateDeviationPerDay_ Allowed token rate deviation per day in basic points.
    constructor(
        address messenger_,
        address l2ERC20TokenBridge_,
        address l1TokenRatePusher_,
        uint256 tokenRateOutdatedDelay_,
        uint256 maxAllowedL2ToL1ClockLag_,
        uint256 maxAllowedTokenRateDeviationPerDay_
    ) CrossDomainEnabled(messenger_) {
        L2_ERC20_TOKEN_BRIDGE = l2ERC20TokenBridge_;
        L1_TOKEN_RATE_PUSHER = l1TokenRatePusher_;
        TOKEN_RATE_OUTDATED_DELAY = tokenRateOutdatedDelay_;
        MAX_ALLOWED_L2_TO_L1_CLOCK_LAG = maxAllowedL2ToL1ClockLag_;
        MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY = maxAllowedTokenRateDeviationPerDay_;
    }

    function initialize(uint256 tokenRate_, uint256 rateL1Timestamp_) external {
        _initializeContractVersionTo(1);
        _setTokenRateAndL1Timestamp(uint192(tokenRate_), uint64(rateL1Timestamp_));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        uint80 roundId = uint80(_getRateL1Timestamp());

        return (
            roundId,
            int256(uint256(_getTokenRate())),
            _getRateL1Timestamp(),
            _getRateL1Timestamp(),
            roundId
        );
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestAnswer() external view returns (int256) {
        return int256(uint256(_getTokenRate()));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateUpdatable
    function updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) external onlyBridgeOrTokenRatePusher {

        /// @dev checks if the time difference between L1 and L2 exceeds the configurable threshold
        if (rateL1Timestamp_ > block.timestamp &&
            rateL1Timestamp_ - block.timestamp > MAX_ALLOWED_L2_TO_L1_CLOCK_LAG) {
            revert ErrorL1TimestampExceededAllowedClockLag(tokenRate_, rateL1Timestamp_);
        }

        /// @dev use only the more actual token rate
        if (rateL1Timestamp_ <= _getRateL1Timestamp()) {
            emit DormantTokenRateUpdateIgnored(tokenRate_, _getRateL1Timestamp(), rateL1Timestamp_);
            return;
        }

        /// @dev allow token rate to be within some configurable range that depens on time it wasn't updated.
        if (!_isTokenRateWithinAllowedRange(tokenRate_, rateL1Timestamp_)) {
            revert ErrorTokenRateIsOutOfRange(tokenRate_, rateL1Timestamp_);
        }

        /// @dev notify that there is a differnce L1 and L2 time.
        if (rateL1Timestamp_ > block.timestamp) {
            emit TokenRateL1TimestampAheadOfL2Time(tokenRate_, rateL1Timestamp_);
        }

        _setTokenRateAndL1Timestamp(uint192(tokenRate_), uint64(rateL1Timestamp_));
        emit RateUpdated(_getTokenRate(), _getRateL1Timestamp());
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp - _getRateL1Timestamp() > TOKEN_RATE_OUTDATED_DELAY;
    }

    /// @dev Allow tokenRate deviation from the previous value to be
    ///      ±`MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY`% per day.
    function _isTokenRateWithinAllowedRange(
        uint256 newTokenRate_, uint256 newRateL1Timestamp_
    ) internal view returns (bool) {
        uint256 rateL1TimestampDiff = newRateL1Timestamp_ - _getRateL1Timestamp();
        uint256 roundedUpNumberOfDays = rateL1TimestampDiff / ONE_DAY_SECONDS + 1;
        uint256 allowedTokenRateDeviation = roundedUpNumberOfDays * MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY;
        uint256 topTokenRateLimit = _getTokenRate() * (BASIS_POINT_SCALE + allowedTokenRateDeviation) /
            BASIS_POINT_SCALE;
        uint256 bottomTokenRateLimit = 0;
        if(allowedTokenRateDeviation <= BASIS_POINT_SCALE) {
            bottomTokenRateLimit = (_getTokenRate() * (BASIS_POINT_SCALE - allowedTokenRateDeviation) /
            BASIS_POINT_SCALE);
        }

        return newTokenRate_ <= topTokenRateLimit &&
               newTokenRate_ >= bottomTokenRateLimit;
    }

    function _isCallerBridgeOrMessegerWithTokenRatePusher(address caller_) internal view returns (bool) {
        if(caller_ == L2_ERC20_TOKEN_BRIDGE) {
            return true;
        }
        if(caller_ == address(MESSENGER) && MESSENGER.xDomainMessageSender() == L1_TOKEN_RATE_PUSHER) {
            return true;
        }
        return false;
    }

    function _getTokenRate() private view returns (uint192) {
        return _loadTokenRateData().tokenRate;
    }

    function _getRateL1Timestamp() private view returns (uint64) {
        return _loadTokenRateData().rateL1Timestamp;
    }

    function _setTokenRateAndL1Timestamp(uint192 tokenRate_, uint64 rateL1Timestamp_) internal {
        _loadTokenRateData().tokenRate = tokenRate_;
        _loadTokenRateData().rateL1Timestamp = rateL1Timestamp_;
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

    modifier onlyBridgeOrTokenRatePusher() {
        if(!_isCallerBridgeOrMessegerWithTokenRatePusher(msg.sender)) {
            revert ErrorNotBridgeOrTokenRatePusher();
        }
        _;
    }

    event RateUpdated(
        uint256 tokenRate_,
        uint256 indexed rateL1Timestamp_
    );
    event DormantTokenRateUpdateIgnored(
        uint256 tokenRate_,
        uint256 indexed currentRateL1Timestamp_,
        uint256 indexed newRateL1Timestamp_
    );
    event TokenRateL1TimestampAheadOfL2Time(
        uint256 tokenRate_,
        uint256 indexed rateL1Timestamp_
    );

    error ErrorNotBridgeOrTokenRatePusher();
    error ErrorL1TimestampExceededAllowedClockLag(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorTokenRateIsOutOfRange(uint256 tokenRate_, uint256 rateL1Timestamp_);
}
