// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice A subset of wstETH token interface of core LIDO protocol.
interface IERC20WstETH {
    /**
     * @notice Get amount of wstETH for a one stETH
     * @return Amount of wstETH for a 1 stETH
     */
    function stETHPerToken() external view returns (uint256);
}
