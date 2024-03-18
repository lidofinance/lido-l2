// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice An interface to subscribe for token rebases. It is used to handle different rollups.
interface ITokenRateObserver {

    /// @notice It's called when rebase event occures.
    function handleTokenRebased() external;
}
