// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateUpdatable} from "./interfaces/ITokenRateUpdatable.sol";
import {IChainlinkAggregatorInterface} from "./interfaces/IChainlinkAggregatorInterface.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Versioned} from "../utils/Versioned.sol";

interface ITokenRateOracle is ITokenRateUpdatable, IChainlinkAggregatorInterface {}

/// @author kovalgek
/// @notice Oracle for storing token rate.
/// @dev Token rate updates can be delivered from two sources: L1 token rate pusher and L2 bridge.
contract TokenRateOracle is CrossDomainEnabled, ITokenRateOracle, Versioned, Initializable {

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

    /// @notice A time period when token rate can be considered outdated.
    uint256 public constant MAX_ALLOWED_L1_L2_TIME_DIFFERENCE = 86400;

    /// @notice Number of seconds in one day.
    uint256 public constant ONE_DAY_SECONDS = 86400;

    /// @notice Allowed token rate deviation per day in basic points.
    uint256 public constant TOKEN_RATE_DEVIATION = 500;

    /// @notice Decimals of the oracle response.
    uint8 public constant DECIMALS = 18;

    /// @notice Basic point scale.
    uint256 private constant BASIS_POINT_SCALE = 1e4;

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

        _disableInitializers();
    }

    function initialize(uint256 tokenRate_, uint256 rateL1Timestamp_) external initializer {
        _initializeContractVersionTo(1);
        _updateRate(tokenRate_, rateL1Timestamp_);
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        uint80 roundId = uint80(_rateL1Timestamp());

        return (
            roundId,
            int256(uint256(_tokenRate())),
            _rateL1Timestamp(),
            _rateL1Timestamp(),
            roundId
        );
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function latestAnswer() external view returns (int256) {
        return int256(uint256(_tokenRate()));
    }

    /// @inheritdoc IChainlinkAggregatorInterface
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITokenRateUpdatable
    function updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) external onlyAuthorized {
        _updateRate(tokenRate_, rateL1Timestamp_);
    }

    /// @notice Returns flag that shows that token rate can be considered outdated.
    function isLikelyOutdated() external view returns (bool) {
        return block.timestamp - _rateL1Timestamp() > TOKEN_RATE_OUTDATED_DELAY;
    }

    function _updateRate(uint256 tokenRate_, uint256 rateL1Timestamp_) internal {
        if (rateL1Timestamp_ < _rateL1Timestamp()) {
            emit ATryToUpdateTokenRateWithOutdatedTime(tokenRate_, _rateL1Timestamp(), rateL1Timestamp_);
            return;
        }

        if (rateL1Timestamp_ - block.timestamp > MAX_ALLOWED_L1_L2_TIME_DIFFERENCE) {
            revert ErrorInvalidTime(tokenRate_, rateL1Timestamp_);
        }

        if (rateL1Timestamp_ > block.timestamp) {
            emit TokenRateL1TimestampAheadOfL2Time();
        }

        if (!_isTokenRateWithinAllowedRange(tokenRate_, rateL1Timestamp_)) {
            revert ErrorTokenRateIsOutOfRange(tokenRate_, rateL1Timestamp_);
        }

        if (tokenRate_ == _tokenRate() && rateL1Timestamp_ == _rateL1Timestamp()) {
            return;
        }

        _setTokenRate(uint192(tokenRate_));
        _setRateL1Timestamp(uint64(rateL1Timestamp_));

        emit RateUpdated(_tokenRate(), _rateL1Timestamp());
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

    function _isTokenRateWithinAllowedRange(uint256 tokenRate_, uint256 rateL1Timestamp_) internal view returns (bool) {
        uint256 rateL1TimestampDiff = rateL1Timestamp_ - _rateL1Timestamp();
        uint256 roundedUpNumberOfDays = rateL1TimestampDiff / ONE_DAY_SECONDS + 1;
        uint256 allowedTokenRateDeviation = roundedUpNumberOfDays * TOKEN_RATE_DEVIATION;
        uint256 topTokenRateLimitFactor = 1 + allowedTokenRateDeviation / BASIS_POINT_SCALE;
        uint256 bottomTokenRateLimitFactor =
            allowedTokenRateDeviation <= BASIS_POINT_SCALE ?
            (1 - allowedTokenRateDeviation / BASIS_POINT_SCALE) : 0;

        return tokenRate_ <= _tokenRate() * topTokenRateLimitFactor &&
               tokenRate_ >= _tokenRate() * bottomTokenRateLimitFactor;
    }

    function _isAuthorized(address caller_) internal view returns (bool) {
        if(caller_ == address(MESSENGER) && MESSENGER.xDomainMessageSender() == L1_TOKEN_RATE_PUSHER) {
            return true;
        }
        if(caller_ == L2_ERC20_TOKEN_BRIDGE) {
            return true;
        }
        return false;
    }

    function _tokenRate() private view returns (uint192) {
        return _loadTokenRateData().tokenRate;
    }

    function _rateL1Timestamp() private view returns (uint64) {
        return _loadTokenRateData().rateL1Timestamp;
    }

    function _setTokenRate(uint192 tokenRate_) internal {
        _loadTokenRateData().tokenRate = tokenRate_;
    }

    function _setRateL1Timestamp(uint64 rateL1Timestamp_) internal {
        _loadTokenRateData().rateL1Timestamp = rateL1Timestamp_;
    }

    modifier onlyAuthorized() {
        if(!_isAuthorized(msg.sender)) {
            revert ErrorNoRights(msg.sender);
        }
        _;
    }

    event RateUpdated(uint256 tokenRate_, uint256 rateL1Timestamp_);
    event ATryToUpdateTokenRateWithOutdatedTime(uint256 tokenRate_, uint256 rateL1Timestamp_, uint256 newTateL1Timestamp_);
    event TokenRateL1TimestampAheadOfL2Time();

    error ErrorNoRights(address caller);
    error ErrorInvalidTime(uint256 tokenRate_, uint256 rateL1Timestamp_);
    error ErrorTokenRateIsOutOfRange(uint256 tokenRate_, uint256 rateL1Timestamp_);
}
