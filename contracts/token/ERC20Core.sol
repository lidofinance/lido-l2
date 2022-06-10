// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/// @author psirex
/// @notice Contains the required logic of the ERC20 standard as defined in the EIP
contract ERC20Core is IERC20 {
    /// @notice The amount of tokens in existence
    uint256 public totalSupply;

    /// @notice Stores the amount of tokens owned by account
    mapping(address => uint256) public balanceOf;

    /// @notice Stores the remaining amount of tokens that spender will be
    ///     allowed to spend on behalf of owner through transferFrom.
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Sets amount_ as the allowance of spender_ over the caller's tokens.
    /// @param spender_ An address of the tokens spender
    /// @param amount_ An amount of tokens to allow to spend
    function approve(address spender_, uint256 amount_)
        public
        returns (bool success)
    {
        allowance[msg.sender][spender_] = amount_;

        emit Approval(msg.sender, spender_, amount_);
        return true;
    }

    /// @notice Moves amount_ tokens from the caller's account to to_
    /// @param to_ An address of the recipient of the tokens
    /// @param amount_ An amount of tokens to transfer
    function transfer(address to_, uint256 amount_)
        public
        returns (bool success)
    {
        _transfer(msg.sender, to_, amount_);
        return true;
    }

    /// @notice Moves amount_ tokens from from_ to to_ using the allowance mechanism.
    ///     amount_ is then deducted from the caller's allowance.
    /// @param from_ An address to transfer tokens from
    /// @param to_ An address of the recipient of the tokens
    /// @param amount_ An amount of tokens to transfer
    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) public returns (bool success) {
        _spendAllowance(from_, to_, amount_);
        _transfer(from_, to_, amount_);
        return true;
    }

    /// @notice Atomically increases the allowance granted to spender by the caller.
    /// @param spender_ An address of the tokens spender
    /// @param addedValue_ An amount to increase the allowance
    function increaseAllowance(address spender_, uint256 addedValue_)
        external
        returns (bool)
    {
        _approve(
            msg.sender,
            spender_,
            allowance[msg.sender][spender_] + addedValue_
        );
        return true;
    }

    /// @notice Atomically decreases the allowance granted to spender by the caller.
    /// @param spender_ An address of the tokens spender
    /// @param subtractedValue_ An amount to decrease the  allowance
    function decreaseAllowance(address spender_, uint256 subtractedValue_)
        external
        returns (bool)
    {
        uint256 currentAllowance = allowance[msg.sender][spender_];
        if (currentAllowance < subtractedValue_) {
            revert ErrorDecreasedAllowanceBelowZero();
        }
        unchecked {
            _approve(msg.sender, spender_, currentAllowance - subtractedValue_);
        }
        return true;
    }

    /// @dev Moves amount_ of tokens from sender_ to recipient_.
    /// @param from_ An address of the sender of the tokens
    /// @param to_  An address of the recipient of the tokens
    /// @param amount_ An amount of tokens to transfer
    function _transfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal onlyNonZeroAccount(from_) onlyNonZeroAccount(to_) {
        _decreaseBalance(from_, amount_);
        balanceOf[to_] += amount_;
        emit Transfer(from_, to_, amount_);
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
        console.log("Mint");
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
