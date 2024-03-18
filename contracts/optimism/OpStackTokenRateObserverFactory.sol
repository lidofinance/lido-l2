// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {OpStackTokenRateObserver} from "./OpStackTokenRateObserver.sol";

/// @author kovalgek
/// @notice Factory for deploying observers for OP stack.
contract OpStackTokenRateObserverFactory {

    /// @notice deploys observer for OP stack.
    /// @param lidoTokensBridge_ OpStack bridge.
    /// @param l2GasLimitForPushingTokenRate_ Gas limit required to complete pushing token rate on L2.
    function deployOpStackTokenRateObserver(
        address lidoTokensBridge_,
        uint32 l2GasLimitForPushingTokenRate_
    ) external returns (OpStackTokenRateObserver opStackTokenRateObserver) {

        opStackTokenRateObserver = new OpStackTokenRateObserver(
            lidoTokensBridge_,
            l2GasLimitForPushingTokenRate_
        );

        emit OpStackTokenRateObserverDeployed(
            msg.sender,
            address(opStackTokenRateObserver),
            lidoTokensBridge_,
            l2GasLimitForPushingTokenRate_
        );

        return opStackTokenRateObserver;
    }

    event OpStackTokenRateObserverDeployed(
        address indexed creator,
        address indexed opStackTokenRateObserver,
        address lidoTokensBridge,
        uint32 l2GasLimitForPushingTokenRate
    );
}
