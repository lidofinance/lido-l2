// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IAccountingOracle} from "../../optimism/TokenRateAndUpdateTimestampProvider.sol";

/// @dev For testing purposes.
contract AccountingOracleStub is IAccountingOracle {

    uint256 private immutable genesisTime;
    uint256 private immutable secondsPerSlot;
    uint256 private immutable lastProcessingRefSlot;

    constructor(uint256 genesisTime_, uint256 secondsPerSlot_, uint256 lastProcessingRefSlot_) {
        genesisTime = genesisTime_;
        secondsPerSlot = secondsPerSlot_;
        lastProcessingRefSlot = lastProcessingRefSlot_;
    }

    function GENESIS_TIME() external view returns (uint256) {
        return genesisTime;
    }

    function SECONDS_PER_SLOT() external view returns (uint256) {
        return secondsPerSlot;
    }

    function getLastProcessingRefSlot() external view returns (uint256) {
        return lastProcessingRefSlot;
    }
}
