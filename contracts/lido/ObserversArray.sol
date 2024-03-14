// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IPostTokenRebaseReceiver} from "./interfaces/IPostTokenRebaseReceiver.sol";
import {ITokenRateObserver} from "./interfaces/ITokenRateObserver.sol";
import {IObserversArray} from "./interfaces/IObserversArray.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @author kovalgek
/// @notice Manage observers.
contract ObserversArray is Ownable, IObserversArray {
    using ERC165Checker for address;

    /// @notice Maximum amount of observers to be supported.
    uint256 public constant MAX_OBSERVERS_COUNT = 16;

    /// @notice Invalid interface id.
    bytes4 constant INVALID_INTERFACE_ID = 0xffffffff;

    /// @notice An interface that each observer should support.
    bytes4 public immutable REQUIRED_INTERFACE;

    /// @notice all observers.
    address[] public observers;

    /// @param requiredInterface_ An interface that each observer should support.
    constructor(bytes4 requiredInterface_) {
        if (requiredInterface_ == INVALID_INTERFACE_ID) {
            revert ErrorInvalidInterface();
        }

        REQUIRED_INTERFACE = requiredInterface_;
    }

    /// @inheritdoc IObserversArray
    function observersLength() public view returns (uint256) {
        return observers.length;
    }

    /// @inheritdoc IObserversArray
    function addObserver(address observer_) external virtual onlyOwner {
        if (observer_ == address(0)) {
            revert ErrorZeroAddressObserver();
        }
        if (!observer_.supportsInterface(REQUIRED_INTERFACE)) {
            revert ErrorBadObserverInterface();
        }
        if (observers.length >= MAX_OBSERVERS_COUNT) {
            revert ErrorMaxObserversCountExceeded();
        }

        observers.push(observer_);
        emit ObserverAdded(observer_);
    }

    /// @inheritdoc IObserversArray
    function removeObserver(address observer_) external virtual onlyOwner {

        uint256 observerIndexToRemove = _observerIndex(observer_);

        if (observerIndexToRemove == type(uint256).max) {
            revert ErrorNoObserverToRemove();
        }

        for (uint256 obIndex = observerIndexToRemove; obIndex < observers.length - 1; obIndex++) {
            observers[obIndex] = observers[obIndex + 1];
        }

        observers.pop();

        emit ObserverRemoved(observer_, observerIndexToRemove);
    }

    /// @notice `observer_` index in `observers` array.
    function _observerIndex(address observer_) internal view returns (uint256) {
        for (uint256 obIndex = 0; obIndex < observers.length; obIndex++) {
            if (observers[obIndex] == observer_) {
                return obIndex;
            }
        }
        return type(uint256).max;
    }

    event FailObserverNotification(address indexed observer);

    error ErrorInvalidInterface();
    error ErrorZeroAddressObserver();
    error ErrorBadObserverInterface();
    error ErrorMaxObserversCountExceeded();
    error ErrorNoObserverToRemove();
}
