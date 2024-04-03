// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @author kovalgek
/// @notice Extends the ERC20 functionality that allows the bridge to mint/burn shares
interface IERC20BridgedShares is IERC20 {
    /// @notice Returns bridge which can mint and burn shares on L2
    function BRIDGE() external view returns (address);

    /// @notice Creates amount_ shares and assigns them to account_, increasing the total shares supply
    /// @param account_ An address of the account to mint shares
    /// @param amount_ An amount of shares to mint
    function bridgeMintShares(address account_, uint256 amount_) external;

    /// @notice Destroys amount_ shares from account_, reducing the total shares supply
    /// @param account_ An address of the account to burn shares
    /// @param amount_ An amount of shares to burn
    function bridgeBurnShares(address account_, uint256 amount_) external;
}
