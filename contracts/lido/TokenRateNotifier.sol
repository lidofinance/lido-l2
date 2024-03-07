// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IPostTokenRebaseReceiver} from "./IPostTokenRebaseReceiver.sol";
import {ITokenRateObserver} from "./ITokenRateObserver.sol";

/// @author kovalgek
/// @notice An interface for Lido core protocol rebase event.
contract TokenRateNotifier is IPostTokenRebaseReceiver {

    event FailObserverNotification(address indexed observer);

    address[] private observers;

    constructor() {
    }

    function registerObserver(address observer) external {
        observers.push(observer);
    }

    function _notifyObservers() internal {
        for(uint observerIndex = 0; observerIndex < observers.length; observerIndex++) {
            _notifyObserver(observers[observerIndex]);
        }
    }

    function _notifyObserver(address observer) internal {
        ITokenRateObserver tokenRateObserver = ITokenRateObserver(observer);

        (bool success, bytes memory returnData) = address(observer).call(
            abi.encodePacked(tokenRateObserver.update.selector)
        );
        if (!success) {
            emit FailObserverNotification(observer);
        }
    }

    function handlePostTokenRebase(uint256, uint256, uint256, uint256, uint256, uint256, uint256) external {
        _notifyObservers();
    }
}
