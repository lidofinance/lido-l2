// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IPostTokenRebaseReceiver} from "./interfaces/IPostTokenRebaseReceiver.sol";
import {ITokenRateObserver} from "./interfaces/ITokenRateObserver.sol";
import {ObserversArray} from "./ObserversArray.sol";

/// @author kovalgek
/// @notice Notifies all observers when rebase event occures.
contract TokenRateNotifier is ObserversArray, IPostTokenRebaseReceiver {

    constructor() ObserversArray(type(ITokenRateObserver).interfaceId)  {
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
        uint256 observersLength = observersLength();

        for (uint256 obIndex = 0; obIndex < observersLength; obIndex++) {
            try ITokenRateObserver(observers[obIndex]).handleTokenRebased() {}
            catch (bytes memory lowLevelRevertData) {
                /// @dev This check is required to prevent incorrect gas estimation of the method.
                ///      Without it, Ethereum nodes that use binary search for gas estimation may
                ///      return an invalid value when the handleTokenRebased() reverts because of the
                ///      "out of gas" error. Here we assume that the handleTokenRebased() method doesn't
                ///      have reverts with empty error data except "out of gas".
                if (lowLevelRevertData.length == 0) revert ErrorUnrecoverableObserver();
                emit HandleTokenRebasedFailed(
                    observers[obIndex],
                    lowLevelRevertData
                );
            }
        }
    }

    event HandleTokenRebasedFailed(address indexed observer, bytes lowLevelRevertData);

    error ErrorUnrecoverableObserver();
}
