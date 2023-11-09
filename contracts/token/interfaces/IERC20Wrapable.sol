// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice Extends the ERC20 functionality that allows the bridge to mint/burn tokens
interface IERC20Wrapable {

    /**
     * @notice Exchanges wstETH to stETH
     * @param sharesAmount_ amount of wstETH to wrap in exchange for stETH
     * @dev Requirements:
     *  - `wstETHAmount_` must be non-zero
     *  - msg.sender must approve at least `wstETHAmount_` stETH to this
     *    contract.
     *  - msg.sender must have at least `wstETHAmount_` of stETH.
     * User should first approve wstETHAmount_ to the StETH contract
     * @return Amount of StETH user receives after wrap
     */
    function wrap(uint256 sharesAmount_) external returns (uint256);

    /**
     * @notice Exchanges stETH to wstETH
     * @param wrapableTokenAmount_ amount of stETH to uwrap in exchange for wstETH
     * @dev Requirements:
     *  - `stETHAmount_` must be non-zero
     *  - msg.sender must have at least `stETHAmount_` stETH.
     * @return Amount of wstETH user receives after unwrap
     */
    function unwrap(uint256 wrapableTokenAmount_) external returns (uint256);

    /**
     * @notice Get amount of wstETH for a one stETH
     * @return Amount of wstETH for a 1 stETH
     */
    function tokensPerStEth() external view returns (uint256);
}