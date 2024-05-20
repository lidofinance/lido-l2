// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20Bridged} from "../token/ERC20Bridged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20WstETH} from "../optimism/TokenRateAndUpdateTimestampProvider.sol";
import {IERC20Wrapper} from "../token/interfaces/IERC20Wrapper.sol";

/// @dev represents wstETH on L1. For testing purposes.
contract ERC20WrapperStub is IERC20Wrapper, IERC20WstETH, ERC20 {

    IERC20 public stETH;
    address public bridge;
    uint256 public tokensRate;
    uint256 private constant DECIMALS = 27;

    constructor(IERC20 stETH_, string memory name_, string memory symbol_, uint256 tokensRate_)
        ERC20(name_, symbol_)
    {
        stETH = stETH_;
        tokensRate = tokensRate_;
        _mint(msg.sender, 1000000 * 10**DECIMALS);
    }

    function wrap(uint256 _stETHAmount) external returns (uint256) {
        require(_stETHAmount > 0, "wstETH: can't wrap zero stETH");

        uint256 wstETHAmount = (_stETHAmount * (10 ** DECIMALS)) / tokensRate;

        _mint(msg.sender, wstETHAmount);
        stETH.transferFrom(msg.sender, address(this), _stETHAmount);

        return wstETHAmount;
    }

    function unwrap(uint256 _wstETHAmount) external returns (uint256) {
        require(_wstETHAmount > 0, "wstETH: zero amount unwrap not allowed");

        uint256 stETHAmount = (_wstETHAmount * tokensRate) / (10 ** DECIMALS);

        _burn(msg.sender, _wstETHAmount);
        stETH.transfer(msg.sender, stETHAmount);

        return stETHAmount;
    }

    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256) {
        return (tokensRate * 10**DECIMALS) / _wstETHAmount;
    }
}
