// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. Mints tokens during deposits and burns tokens during withdrawals.
interface IL2ERC20Bridge {
    event FinalizeDeposit(
        address indexed l1Sender,
        address indexed l2Receiver,
        address indexed l2Token,
        uint256 amount,
        bytes data_
    );

    event WithdrawalInitiated(
        address indexed l2Sender,
        address indexed l1Receiver,
        address indexed l2Token,
        uint256 amount
    );

    /// @notice Finalize the deposit and mint tokens
    /// @param l1Sender_ The account address that initiated the deposit on L1
    /// @param l2Receiver_ The account address that would receive minted tokens
    /// @param l1Token_ The address of the token that was locked on the L1
    /// @param amount_ Total amount of tokens deposited from L1
    /// @param data_ The additional data that user can pass with the deposit
    function finalizeDeposit(
        address l1Sender_,
        address l2Receiver_,
        address l1Token_,
        uint256 amount_,
        bytes calldata data_
    ) external payable;

    /// @notice Initiates a withdrawal by burning tokens on the contract and sending the message to L1
    /// where tokens would be unlocked
    /// @param l1Receiver_ The account address that should receive tokens on L1
    /// @param l2Token_ The L2 token address which is withdrawn
    /// @param amount_ The total amount of tokens to be withdrawn
    function withdraw(
        address l1Receiver_,
        address l2Token_,
        uint256 amount_
    ) external;

    /// @notice Returns the address of the L1 token contract
    function l1TokenAddress(address l2Token_) external view returns (address);

    /// @notice Returns the address of the L2 token contract
    function l2TokenAddress(address l1Token_) external view returns (address);

    /// @notice Returns the address of the corresponding L1 bridge contract
    function l1Bridge() external view returns (address);
}
