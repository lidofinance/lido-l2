// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";

contract TokenRateOracleStub is ITokenRateOracle {

    uint8 public _decimals;

    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }
    
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    int256 public latestRoundDataAnswer;

    function setLatestRoundDataAnswer(int256 answer_) external {
        latestRoundDataAnswer = answer_;
    }

    uint256 public latestRoundDataUpdatedAt;

    function setUpdatedAt(uint256 updatedAt_) external {
        latestRoundDataUpdatedAt = updatedAt_;
    }

    /**
     * @notice get data about the latest round.
     */
    function latestRoundData()
      external
      view
      returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
      ) {
        return (0,latestRoundDataAnswer,0,latestRoundDataUpdatedAt,0);
      }

    function latestAnswer() external view returns (int256) {
        return latestRoundDataAnswer;
    }

    function updateRate(int256 tokenRate_, uint256 rateL1Timestamp_, uint256 lastProcessingRefSlot_) external {
      // check timestamp not late as current one.
      latestRoundDataAnswer = tokenRate_;
      latestRoundDataUpdatedAt = rateL1Timestamp_;
    }
}