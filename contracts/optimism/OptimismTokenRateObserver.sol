// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateObserver} from "../lido/ITokenRateObserver.sol";
import {L1LidoTokensBridge} from "./L1LidoTokensBridge.sol";

/// @author kovalgek
/// @notice An interface for Lido core protocol rebase event.
contract OptimismTokenRateObserver is ITokenRateObserver {

    L1LidoTokensBridge l1LidoTokensBridge;

    constructor(address lidoTokensBridge) {
        l1LidoTokensBridge = L1LidoTokensBridge(lidoTokensBridge);
    }

    function update() external {
        l1LidoTokensBridge.pushTokenRate(10_000);
    }
}
