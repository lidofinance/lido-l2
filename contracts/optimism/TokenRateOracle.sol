// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateUpdatable} from "./interfaces/ITokenRateUpdatable.sol";
import {IChainlinkAggregatorInterface} from "./interfaces/IChainlinkAggregatorInterface.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {Versioned} from "../utils/Versioned.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {UnstructuredStorage} from "../lib/UnstructuredStorage.sol";

interface ITokenRateOracle is ITokenRateUpdatable, IChainlinkAggregatorInterface {}

/// @author kovalgek
/// @notice Oracle for storing and providing token rate.
///         NB: Cross-chain apps and CEXes should fetch the token rate specific to the chain for deposits/withdrawals
///         and compare against the token rate on L1 being a source of truth;
/// @dev Token rate updates can be delivered from two sources: L1 token rate pusher and L2 bridge.
contract TokenRateOracle is ITokenRateOracle, CrossDomainEnabled, AccessControl, Versioned {

    using UnstructuredStorage for bytes32;

    /// @dev Uses to store historical data of rate and times.
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
    uint256 public immutable MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY_BP;

    /// @notice The maximum allowed time difference between the current time and the last received
    ///         token rate update that can be set during a pause. This is required to limit the pause role
    ///         and prevent potential economic attacks.
    uint256 public immutable OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN;

    /// @notice The maximum delta time that is allowed between two L1 timestamps of token rate updates.
    uint256 public immutable MAX_ALLOWED_TIME_BETWEEEN_TOKEN_RATE_UPDATES;

    /// @notice Decimals of the oracle response.
    uint8 public constant DECIMALS = 27;

    /// @notice Max sane token rate value.
    uint256 public constant MAX_SANE_TOKEN_RATE = 10 ** (DECIMALS + 2);

    /// @notice Min sane token rate value.
    uint256 public constant MIN_SANE_TOKEN_RATE = 10 ** (DECIMALS - 2);

    /// @dev Role granting the permission to pause updating rate.
    bytes32 public constant RATE_UPDATE_DISABLER_ROLE = keccak256("TokenRateOracle.RATE_UPDATE_DISABLER_ROLE");

    /// @dev Role granting the permission to unpause updating rate.
    bytes32 public constant RATE_UPDATE_ENABLER_ROLE = keccak256("TokenRateOracle.RATE_UPDATE_ENABLER_ROLE");

    /// @notice Basic point scale.
    uint256 private constant BASIS_POINT_SCALE = 1e4;

    /// @notice Number of seconds in one day.
    uint256 private constant ONE_DAY_SECONDS = 86400;

    /// @notice Flag to pause token rate updates slot position.
    bytes32 private constant PAUSE_TOKEN_RATE_UPDATES_SLOT = keccak256("TokenRateOracle.PAUSE_TOKEN_RATE_UPDATES_SLOT");

    /// @notice Token rates array slot position.
    bytes32 private constant TOKEN_RATES_DATA_SLOT = keccak256("TokenRateOracle.TOKEN_RATES_DATA_SLOT");

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l2ERC20TokenBridge_ the bridge address that has a right to updates oracle.
    /// @param l1TokenRatePusher_ An address of account on L1 that can update token rate.
    /// @param tokenRateOutdatedDelay_ time period when token rate can be considered outdated.
    /// @param maxAllowedL2ToL1ClockLag_ A time difference between received l1Timestamp and L2 block.timestamp
    ///         when token rate can be considered outdated.
    /// @param maxAllowedTokenRateDeviationPerDayBp_ Allowed token rate deviation per day in basic points.
    ///        Can't be bigger than BASIS_POINT_SCALE.
    /// @param oldestRateAllowedInPauseTimeSpan_ Maximum allowed time difference between the current time
    ///        and the last received token rate update that can be set during a pause.
    /// @param maxAllowedTimeBetweenTokenRateUpdates_ he maximum delta time that is allowed between two
    ///        L1 timestamps of token rate updates.
    constructor(
        address messenger_,
        address l2ERC20TokenBridge_,
        address l1TokenRatePusher_,
        uint256 tokenRateOutdatedDelay_,
        uint256 maxAllowedL2ToL1ClockLag_,
        uint256 maxAllowedTokenRateDeviationPerDayBp_,
        uint256 oldestRateAllowedInPauseTimeSpan_,
        uint256 maxAllowedTimeBetweenTokenRateUpdates_
    ) CrossDomainEnabled(messenger_) {
        if (l2ERC20TokenBridge_ == address(0)) {
            revert ErrorZeroAddressL2ERC20TokenBridge();
        }
        if (l1TokenRatePusher_ == address(0)) {
            revert ErrorZeroAddressL1TokenRatePusher();
        }
        if (maxAllowedTokenRateDeviationPerDayBp_ > BASIS_POINT_SCALE) {
            revert ErrorMaxTokenRateDeviationIsOutOfRange();
        }
        L2_ERC20_TOKEN_BRIDGE = l2ERC20TokenBridge_;
        L1_TOKEN_RATE_PUSHER = l1TokenRatePusher_;
        TOKEN_RATE_OUTDATED_DELAY = tokenRateOutdatedDelay_;
        MAX_ALLOWED_L2_TO_L1_CLOCK_LAG = maxAllowedL2ToL1ClockLag_;
        MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY_BP = maxAllowedTokenRateDeviationPerDayBp_;
        OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN = oldestRateAllowedInPauseTimeSpan_;
        MAX_ALLOWED_TIME_BETWEEEN_TOKEN_RATE_UPDATES = maxAllowedTimeBetweenTokenRateUpdates_;
    }

    /// @notice Initializes the contract from scratch.
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    /// @param tokenRate_ wstETH/stETH token rate, uses 10**DECIMALS precision.
    /// @param rateUpdateL1Timestamp_ L1 time when rate was updated on L1 side.
    function initialize(address admin_, uint256 tokenRate_, uint256 rateUpdateL1Timestamp_) external {
        _initializeContractVersionTo(1);
        if (admin_ == address(0)) {
            revert ErrorZeroAddressAdmin();
        }
        if (tokenRate_ < MIN_SANE_TOKEN_RATE || tokenRate_ > MAX_SANE_TOKEN_RATE) {
            revert ErrorTokenRateInitializationIsOutOfSaneRange(tokenRate_);
        }
        if (rateUpdateL1Timestamp_ > block.timestamp + MAX_ALLOWED_L2_TO_L1_CLOCK_LAG) {
            revert ErrorL1TimestampInitializationIsOutOfAllowedRange(rateUpdateL1Timestamp_);
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _addTokenRate(tokenRate_, rateUpdateL1Timestamp_, block.timestamp);
    }

    /// @notice Pauses token rate updates and sets the old rate provided by tokenRateIndex_.
    ///         Should be called by DAO or emergency breaks only.
    /// @param tokenRateIndex_ The index of the token rate that applies after the pause.
    ///        Token Rate can't be received older then OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN
    ///        except only if the passed index is the latest one.
    function pauseTokenRateUpdates(uint256 tokenRateIndex_) external onlyRole(RATE_UPDATE_DISABLER_ROLE) {
        if (_isPaused()) {
            revert ErrorAlreadyPaused();
        }
        TokenRateData memory tokenRateData = _getTokenRateByIndex(tokenRateIndex_);
        if (tokenRateIndex_ != _getStorageTokenRates().length - 1 &&
            tokenRateData.rateReceivedL2Timestamp < block.timestamp - OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN) {
            revert ErrorTokenRateUpdateTooOld();
        }
        _removeElementsAfterIndex(tokenRateIndex_);
        _setPause(true);
        emit TokenRateUpdatesPaused(tokenRateData.tokenRate, tokenRateData.rateUpdateL1Timestamp);
        emit RateUpdated(tokenRateData.tokenRate, tokenRateData.rateUpdateL1Timestamp);
    }

    /// @notice Resume token rate updates applying provided token rate.
    /// @param tokenRate_ a new token rate that applies after unpausing.
    /// @param rateUpdateL1Timestamp_ L1 time when rate was updated on L1 side.
    function resumeTokenRateUpdates(
        uint256 tokenRate_,
        uint256 rateUpdateL1Timestamp_
    ) external onlyRole(RATE_UPDATE_ENABLER_ROLE) {
        if (!_isPaused()) {
            revert ErrorAlreadyResumed();
        }
        _addTokenRate(tokenRate_, rateUpdateL1Timestamp_, block.timestamp);
        _setPause(false);
        emit TokenRateUpdatesResumed(tokenRate_, rateUpdateL1Timestamp_);
        emit RateUpdated(tokenRate_, rateUpdateL1Timestamp_);
    }

    /// @notice Shows that token rate updates are paused or not.
    function isTokenRateUpdatesPaused() external view returns (bool) {
        return _isPaused();
    }

    /// @notice Returns token rate data by index.
    /// @param tokenRateIndex_ an index of token rate data.
    function getTokenRateByIndex(uint256 tokenRateIndex_) external view returns (TokenRateData memory) {
        return _getTokenRateByIndex(tokenRateIndex_);
    }

    /// @notice Returns token rates data length.
    function getTokenRatesLength() external view returns (uint256) {
        return _getStorageTokenRates().length;
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        TokenRateData memory tokenRateData = _getLastTokenRate();
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
        TokenRateData memory tokenRateData = _getLastTokenRate();
        return int256(uint256(tokenRateData.tokenRate));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateUpdatable
    function updateRate(
        uint256 tokenRate_,
        uint256 rateUpdateL1Timestamp_
    ) external onlyBridgeOrTokenRatePusher {
        if (_isPaused()) {
            emit TokenRateUpdateAttemptDuringPause(tokenRate_, rateUpdateL1Timestamp_);
            return;
        }

        TokenRateData storage tokenRateData = _getLastTokenRate();

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
            tokenRateData.rateReceivedL2Timestamp = uint64(block.timestamp);
            emit RateReceivedTimestampUpdated(block.timestamp);
            return;
        }

        /// @dev This condition was made under the assumption that the L1 timestamps can be hacked.
        /// Normally L1 timestamps (oracle reports) can't be less than 24 hours.
        if (rateUpdateL1Timestamp_ < tokenRateData.rateUpdateL1Timestamp + MAX_ALLOWED_TIME_BETWEEEN_TOKEN_RATE_UPDATES) {
            emit UpdateRateIsTooOften();
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

        _addTokenRate(tokenRate_, rateUpdateL1Timestamp_, block.timestamp);
        emit RateUpdated(tokenRate_, rateUpdateL1Timestamp_);
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return (block.timestamp > _getLastTokenRate().rateReceivedL2Timestamp + TOKEN_RATE_OUTDATED_DELAY) ||
            _isPaused();
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
        return roundedUpNumberOfDays * MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY_BP;
    }

    /// @dev Returns the maximum allowable value for the token rate.
    function _maxTokenRateLimit(
        uint256 currentTokenRate,
        uint256 allowedTokenRateDeviation
    ) internal pure returns (uint256) {
        uint256 maxTokenRateLimit = currentTokenRate * (BASIS_POINT_SCALE + allowedTokenRateDeviation) /
            BASIS_POINT_SCALE;
        return Math.min(maxTokenRateLimit, MAX_SANE_TOKEN_RATE);
    }

    /// @dev Returns the minimum allowable value for the token rate.
    function _minTokenRateLimit(
        uint256 currentTokenRate,
        uint256 allowedTokenRateDeviation
    ) internal pure returns (uint256) {
        uint256 minTokenRateLimit = MIN_SANE_TOKEN_RATE;
        if (allowedTokenRateDeviation <= BASIS_POINT_SCALE) {
            minTokenRateLimit = (currentTokenRate * (BASIS_POINT_SCALE - allowedTokenRateDeviation) /
            BASIS_POINT_SCALE);
        }
        return Math.max(minTokenRateLimit, MIN_SANE_TOKEN_RATE);
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

    function _addTokenRate(
        uint256 tokenRate_, uint256 rateUpdateL1Timestamp_, uint256 rateReceivedL2Timestamp_
    ) internal {
        _getStorageTokenRates().push(TokenRateData({
            tokenRate: uint128(tokenRate_),
            rateUpdateL1Timestamp: uint64(rateUpdateL1Timestamp_),
            rateReceivedL2Timestamp: uint64(rateReceivedL2Timestamp_)
        }));
    }

    function _getLastTokenRate() internal view returns (TokenRateData storage) {
        return _getTokenRateByIndex(_getStorageTokenRates().length - 1);
    }

    function _getTokenRateByIndex(uint256 tokenRateIndex_) internal view returns (TokenRateData storage) {
        if (tokenRateIndex_ >= _getStorageTokenRates().length) {
            revert ErrorWrongTokenRateIndex();
        }
        return _getStorageTokenRates()[tokenRateIndex_];
    }

    function _getStorageTokenRates() internal pure returns (TokenRateData [] storage result) {
        bytes32 position = TOKEN_RATES_DATA_SLOT;
        assembly {
            result.slot := position
        }
    }

    /// @dev tokenRateIndex_ is limited by time in the past and the number of elements also has restrictions.
    /// Therefore, this loop can't consume a lot of gas.
    function _removeElementsAfterIndex(uint256 tokenRateIndex_) internal {
        uint256 tokenRatesLength = _getStorageTokenRates().length;
        if (tokenRateIndex_ >= tokenRatesLength) {
            return;
        }
        uint256 numberOfElementsToRemove = tokenRatesLength - tokenRateIndex_ - 1;
        for (uint256 i = 0; i < numberOfElementsToRemove; i++) {
            _getStorageTokenRates().pop();
        }
    }

    function _setPause(bool pause) internal {
        PAUSE_TOKEN_RATE_UPDATES_SLOT.setStorageBool(pause);
    }

    function _isPaused() internal view returns (bool) {
        return PAUSE_TOKEN_RATE_UPDATES_SLOT.getStorageBool();
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
    event TokenRateUpdatesPaused(uint256 tokenRate_, uint256 indexed rateL1Timestamp_);
    event TokenRateUpdatesResumed(uint256 tokenRate_, uint256 indexed rateL1Timestamp_);
    event TokenRateUpdateAttemptDuringPause(uint256 tokenRate_, uint256 indexed rateL1Timestamp_);
    event UpdateRateIsTooOften();

    error ErrorZeroAddressAdmin();
    error ErrorWrongTokenRateIndex();
    error ErrorTokenRateUpdateTooOld();
    error ErrorAlreadyPaused();
    error ErrorAlreadyResumed();
    error ErrorZeroAddressL2ERC20TokenBridge();
    error ErrorZeroAddressL1TokenRatePusher();
    error ErrorNotBridgeOrTokenRatePusher();
    error ErrorL1TimestampExceededAllowedClockLag(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorTokenRateIsOutOfRange(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorMaxTokenRateDeviationIsOutOfRange();
    error ErrorTokenRateInitializationIsOutOfSaneRange(uint256 tokenRate_);
    error ErrorL1TimestampInitializationIsOutOfAllowedRange(uint256 rateL1Timestamp_);
}
