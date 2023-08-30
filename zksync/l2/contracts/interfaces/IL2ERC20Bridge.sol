// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. Mints tokens during deposits and burns tokens during withdrawals.
interface IL2ERC20Bridge {
    /**
     * @dev Emitted when the finalizeDeposit function is called
     * @param l1Sender The address of the sender on L1
     * @param l2Receiver The address of token receiver on L2
     * @param l2Token The address of L2 token
     * @param amount The amount of tokens to be minted
     **/
    event FinalizeDeposit(
        address indexed l1Sender,
        address indexed l2Receiver,
        address indexed l2Token,
        uint256 amount
    );

    /**
     * @dev Emitted when the withdraw function is called
     * @param l2Sender The address of the sender on L2
     * @param l1Receiver The address of token receiver on L1
     * @param l2Token The address of L2 token
     * @param amount The amount of tokens to be withdrawn
     **/
    event WithdrawalInitiated(
        address indexed l2Sender,
        address indexed l1Receiver,
        address indexed l2Token,
        uint256 amount
    );

    /// @notice Finalize the deposit and mint tokens
    /// @param _l1Sender The account address that initiated the deposit on L1
    /// @param _l2Receiver The account address that would receive minted tokens
    /// @param _l1Token The address of the token that was locked on the L1
    /// @param _amount Total amount of tokens deposited from L1
    /// @param _data The additional data that user can pass with the deposit
    function finalizeDeposit(
        address _l1Sender,
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        bytes calldata _data
    ) external payable;

    /// @notice Initiates a withdrawal by burning tokens on the contract and sending the message to L1
    /// where tokens would be unlocked
    /// @param _l1Receiver The account address that should receive tokens on L1
    /// @param _l2Token The L2 token address which is withdrawn
    /// @param _amount The total amount of tokens to be withdrawn
    function withdraw(
        address _l1Receiver,
        address _l2Token,
        uint256 _amount
    ) external;

    /// @notice Returns the address of the L1 token contract
    function l1TokenAddress(address _l2Token) external view returns (address);

    /// @notice Returns the address of the L2 token contract
    function l2TokenAddress(address _l1Token) external view returns (address);

    /// @notice Returns the address of the corresponding L1 bridge contract
    function l1Bridge() external view returns (address);
}
