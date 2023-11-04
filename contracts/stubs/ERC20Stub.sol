// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { console } from "hardhat/console.sol";

contract ERC20Stub is IERC20 {

    uint256 totalSupply_;
    uint256 balanceOf_;
    bool transfer_;
    uint256 allowance_;
    bool approve_;
    bool transferFrom_;

    constructor() {
        totalSupply_ = 0;
        balanceOf_ = 0;
        transfer_ = true;
        allowance_ = 0;
        approve_ = true;
        transferFrom_ = true;
    }

    function totalSupply() external view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balanceOf_;
    }

    address public transferTo;
    uint256 public transferAmount;

    function transfer(address to, uint256 amount) external returns (bool) {
        transferTo = to;
        transferAmount = amount;
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return 0;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return true;
    }

    address public transferFromAddress;
    address public transferFromTo;
    uint256 public transferFromAmount;

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        transferFromAddress = from;
        transferFromTo = to;
        transferFromAmount = amount;
        return true;
    }
}