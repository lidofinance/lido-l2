// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateObserver} from "../lido/interfaces/ITokenRateObserver.sol";
import {L1LidoTokensBridge} from "./L1LidoTokensBridge.sol";

/// @author kovalgek
/// @notice Pushes token rate when rebase event happens.
contract OpStackTokenRateObserver is ITokenRateObserver {

    /// @notice Contract of OpStack bridge.
    L1LidoTokensBridge public immutable L1_LIDO_TOKENS_BRIDGE;

    /// @notice Gas limit required to complete pushing token rate on L2.
    uint32 public immutable L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE;

    /// @param lidoTokensBridge_ OpStack bridge.
    constructor(address lidoTokensBridge_, uint32 l2GasLimitForPushingTokenRate_) {
        L1_LIDO_TOKENS_BRIDGE = L1LidoTokensBridge(lidoTokensBridge_);
        L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE = l2GasLimitForPushingTokenRate_;
    }

    /// @inheritdoc ITokenRateObserver
    function handleTokenRebased() external {
        L1_LIDO_TOKENS_BRIDGE.pushTokenRate(L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE);
    }
}
