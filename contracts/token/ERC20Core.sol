// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20Core is IERC20 {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount)
        public
        returns (bool success)
    {
        allowance[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount)
        public
        returns (bool success)
    {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public returns (bool success) {
        _spendAllowance(from, to, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        external
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            allowance[msg.sender][spender] + addedValue
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        returns (bool)
    {
        uint256 currentAllowance = allowance[msg.sender][spender];
        if (currentAllowance < subtractedValue) {
            revert ErrorDecreasedAllowanceBelowZero();
        }
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal onlyNonZeroAccount(from) onlyNonZeroAccount(to) {
        _decreaseBalance(from, amount);
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _spendAllowance(
        address account,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = allowance[account][spender];
        if (currentAllowance == type(uint256).max) {
            return;
        }
        if (amount > currentAllowance) {
            revert ErrorNotEnoughAllowance();
        }
        unchecked {
            _approve(account, spender, currentAllowance - amount);
        }
    }

    function _approve(
        address account,
        address spender,
        uint256 amount
    ) internal virtual onlyNonZeroAccount(account) onlyNonZeroAccount(spender) {
        allowance[account][spender] = amount;
        emit Approval(account, spender, amount);
    }

    function _mint(address account, uint256 amount)
        internal
        onlyNonZeroAccount(account)
    {
        totalSupply += amount;
        balanceOf[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        onlyNonZeroAccount(account)
    {
        _decreaseBalance(account, amount);
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    function _decreaseBalance(address account, uint256 amount) internal {
        uint256 balance = balanceOf[account];

        if (amount > balance) {
            revert ErrorNotEnoughBalance();
        }
        unchecked {
            balanceOf[account] = balance - amount;
        }
    }

    modifier onlyNonZeroAccount(address account_) {
        if (account_ == address(0)) {
            revert ErrorZeroAddress();
        }
        _;
    }

    error ErrorZeroAddress();
    error ErrorNotEnoughBalance();
    error ErrorNotEnoughAllowance();
    error ErrorDecreasedAllowanceBelowZero();
}
