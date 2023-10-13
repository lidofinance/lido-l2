// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokensRateOracle} from "../token/interfaces/ITokensRateOracle.sol";

contract TokensRateOracleStub is ITokensRateOracle {

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
        return (0,latestRoundDataAnswer,0,0,0);
      }
}