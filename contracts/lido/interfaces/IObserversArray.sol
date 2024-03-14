// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
interface IObserversArray {
    /**
      * @notice Observer added event
      *
      * @dev emitted by `addObserver` and `insertObserver` functions
      */
    event ObserverAdded(address indexed observer);

    /**
      * @notice Observer removed event
      *
      * @dev emitted by `removeObserver` function
      */
    event ObserverRemoved(address indexed observer, uint256 atIndex);

    /**
      * @notice Observer length
      * @return Added observers count
      */
    function observersLength() external view returns (uint256);

    /**
      * @notice Add a `_observer` to the back of array
      * @param observer_ observer address
      *
      * @dev cheapest way to insert new item (doesn't incur additional moves)
      */
    function addObserver(address observer_) external;

    /**
      * @notice Remove a observer at the given `observer_` position
      * @param observer_ observer remove position
      *
      * @dev remove gas cost is higher for the lower `observer_` values
      */
    function removeObserver(address observer_) external;

    /**
      * @notice Get observer at position
      * @return Observer at the given `atIndex_`
      *
      * @dev function reverts if `atIndex_` is out of range
      */
    function observers(uint256 atIndex_) external view returns (address);
}
