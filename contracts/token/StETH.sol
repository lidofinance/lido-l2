// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IStETH} from "./interfaces/IStETH.sol";
import {ERC20Bridged} from "./ERC20Bridged.sol";

/// @author kovalgek
/// @notice Extends the ERC20Bridged functionality
contract StETH is ERC20Bridged, IStETH {

    IERC20 public wstETH;

    /// @param wstETH_ address of the WstETH token to wrap
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    /// @param bridge_ The bridge address which allowd to mint/burn tokens
    constructor(
        IERC20 wstETH_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address bridge_
    ) ERC20Bridged(name_, symbol_, decimals_, bridge_) {
        wstETH = wstETH_;
    }

    function wstETH_to_stETH_rate() public pure returns (uint256) {
        return 2;
    }

    function wrap(uint256 wstETHAmount_) external returns (uint256) {
        require(wstETHAmount_ > 0, "stETH: can't wrap zero wstETH");
        uint256 stETHAmount = wstETHAmount_ / wstETH_to_stETH_rate(); 
        _mint(msg.sender, stETHAmount);
        wstETH.transferFrom(msg.sender, address(this), wstETHAmount_);
        return stETHAmount;
    }

    function unwrap(uint256 stETHAmount_) external returns (uint256) {
        require(stETHAmount_ > 0, "stETH: zero amount unwrap not allowed");
        uint256 wstETHAmount = stETHAmount_ * wstETH_to_stETH_rate();
        _burn(msg.sender, stETHAmount_);
        wstETH.transfer(msg.sender, wstETHAmount);
        return wstETHAmount;
    }
}