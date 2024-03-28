// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice Token rate interface.
interface IERC20TokenRate {

    /// @notice Returns token rate.
    function tokenRate() external view returns (uint256);
}
