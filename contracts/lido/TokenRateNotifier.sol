// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IPostTokenRebaseReceiver} from "./interfaces/IPostTokenRebaseReceiver.sol";
import {ITokenRatePusher} from "./interfaces/ITokenRatePusher.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/// @author kovalgek
/// @notice Notifies all observers when rebase event occures.
contract TokenRateNotifier is Ownable, IPostTokenRebaseReceiver {
    using ERC165Checker for address;

    /// @notice Maximum amount of observers to be supported.
    uint256 public constant MAX_OBSERVERS_COUNT = 16;

    /// @notice Invalid interface id.
    bytes4 public constant INVALID_INTERFACE_ID = 0xffffffff;

    /// @notice A value that indicates that value was not found.
    uint256 public constant INDEX_NOT_FOUND = type(uint256).max;

    /// @notice An interface that each observer should support.
    bytes4 public constant REQUIRED_INTERFACE = type(ITokenRatePusher).interfaceId;

    /// @notice All observers.
    address[] public observers;

    /// @notice Add a `observer_` to the back of array
    /// @param observer_ observer address
    function addObserver(address observer_) external onlyOwner {
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

    /// @notice Remove a observer at the given `observer_` position
    /// @param observer_ observer remove position
    function removeObserver(address observer_) external onlyOwner {

        uint256 observerIndexToRemove = _observerIndex(observer_);

        if (observerIndexToRemove == INDEX_NOT_FOUND) {
            revert ErrorNoObserverToRemove();
        }

        for (uint256 obIndex = observerIndexToRemove; obIndex < observers.length - 1; obIndex++) {
            observers[obIndex] = observers[obIndex + 1];
        }

        observers.pop();

        emit ObserverRemoved(observer_);
    }

    /// @inheritdoc IPostTokenRebaseReceiver
    function handlePostTokenRebase(
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    ) external {
        for (uint256 obIndex = 0; obIndex < observers.length; obIndex++) {
            try ITokenRatePusher(observers[obIndex]).pushTokenRate() {}
            catch (bytes memory lowLevelRevertData) {
                /// @dev This check is required to prevent incorrect gas estimation of the method.
                ///      Without it, Ethereum nodes that use binary search for gas estimation may
                ///      return an invalid value when the pushTokenRate() reverts because of the
                ///      "out of gas" error. Here we assume that the pushTokenRate() method doesn't
                ///      have reverts with empty error data except "out of gas".
                if (lowLevelRevertData.length == 0) revert ErrorTokenRateNotifierRevertedWithNoData();
                emit PushTokenRateFailed(
                    observers[obIndex],
                    lowLevelRevertData
                );
            }
        }
    }

    /// @notice Observer length
    /// @return Added observers count
    function observersLength() public view returns (uint256) {
        return observers.length;
    }

    /// @notice `observer_` index in `observers` array.
    /// @return An index of `observer_` or `INDEX_NOT_FOUND` if it wasn't found.
    function _observerIndex(address observer_) internal view returns (uint256) {
        for (uint256 obIndex = 0; obIndex < observers.length; obIndex++) {
            if (observers[obIndex] == observer_) {
                return obIndex;
            }
        }
        return INDEX_NOT_FOUND;
    }

    event PushTokenRateFailed(address indexed observer, bytes lowLevelRevertData);
    event ObserverAdded(address indexed observer);
    event ObserverRemoved(address indexed observer);

    error ErrorTokenRateNotifierRevertedWithNoData();
    error ErrorZeroAddressObserver();
    error ErrorBadObserverInterface();
    error ErrorMaxObserversCountExceeded();
    error ErrorNoObserverToRemove();
}
