// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

interface IL1ERC20Bridge {
    /**
     * @dev Emitted when the deposit function is called
     * @param l2DepositTxHash The L2 transaction hash of deposit finalization
     * @param from The address of the sender
     * @param to The address of the the recipient
     * @param refundRecipient The address of the refundRecipient on L2
     * @param l1Token The address of the token on L1
     * @param amount The amount of tokens deposited
     **/
    event DepositInitiated(
        bytes32 indexed l2DepositTxHash,
        address indexed from,
        address indexed to,
        address l1Token,
        uint256 amount,
        address refundRecipient
    );

    /**
     * @dev Emitted when the finalizeWithdrawal function is called
     * @param to The address of the recipient on L1
     * @param l1Token The address of L1 token
     * @param amount The amount of tokens to be withdrawn
     **/
    event WithdrawalFinalized(
        address indexed to,
        address indexed l1Token,
        uint256 amount
    );

    /**
     * @dev Emitted when the claimFailedDeposit function is called
     * @param to The address of the the recipient on L1
     * @param l1Token The address of L1 token
     * @param amount The amount of tokens to be claimed
     **/
    event ClaimedFailedDeposit(
        address indexed to,
        address indexed l1Token,
        uint256 amount
    );

    /// @notice A mapping L2 block number => message number => flag
    /// @notice Used to indicate that zkSync L2 -> L1 message was already processed
    function isWithdrawalFinalized(
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex
    ) external view returns (bool);

    /// @dev Initializes a contract bridge for later use. Expected to be used in the proxy
    /// @dev During initialization deploys L2 bridge counterpart as well as provides some factory deps for it
    /// @param _factoryDeps A list of raw bytecodes that are needed for deployment of the L2 bridge
    /// @notice _factoryDeps[0] == a raw bytecode of L2 bridge implementation
    /// @notice _factoryDeps[1] == a raw bytecode of proxy that is used as L2 bridge
    /// @param _governor Address which can change L2 token implementation and upgrade the bridge
    /// @param _deployBridgeImplementationFee How much of the sent value should be allocated to deploying the L2 bridge implementation
    /// @param _deployBridgeProxyFee How much of the sent value should be allocated to deploying the L2 bridge proxy
    function initialize(
        bytes[] calldata _factoryDeps,
        address _governor,
        address _l1Token,
        address _l2Token,
        uint256 _deployBridgeImplementationFee,
        uint256 _deployBridgeProxyFee
    ) external payable;

    /// @notice Initiates a deposit by locking funds on the contract and sending the request
    /// of processing an L2 transaction where tokens would be minted
    /// @param _l2Receiver The account address that should receive funds on L2
    /// @param _l1Token The L1 token address which is deposited
    /// @param _amount The total amount of tokens to be bridged
    /// @param _l2TxGasLimit The L2 gas limit to be used in the corresponding L2 transaction
    /// @param _l2TxGasPerPubdataByte The gasPerPubdataByteLimit to be used in the corresponding L2 transaction
    /// @param _refundRecipient The address on L2 that will receive the refund for the transaction. If the transaction fails,
    /// it will also be the address to receive `_l2Value`. If zero, the refund will be sent to the sender of the transaction.
    /// @return txHash The L2 transaction hash of deposit finalization
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte,
        address _refundRecipient
    ) external payable returns (bytes32 txHash);

    /// @notice Initiates a deposit by locking funds on the contract and sending the request
    /// of processing an L2 transaction where tokens would be minted
    /// @param _l2Receiver The account address that should receive funds on L2
    /// @param _l1Token The L1 token address which is deposited
    /// @param _amount The total amount of tokens to be bridged
    /// @param _l2TxGasLimit The L2 gas limit to be used in the corresponding L2 transaction
    /// @param _l2TxGasPerPubdataByte The gasPerPubdataByteLimit to be used in the corresponding L2 transaction
    /// @return l2TxHash The L2 transaction hash of deposit finalization
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte
    ) external payable returns (bytes32 l2TxHash);

    /// @dev Withdraw funds from the initiated deposit, that failed when finalizing on L2
    /// @param _depositSender The address of the deposit initiator
    /// @param _l1Token The address of the deposited L1 ERC20 token
    /// @param _l2TxHash The L2 transaction hash of the failed deposit finalization
    /// @param _l2BlockNumber The L2 block number where the deposit finalization was processed
    /// @param _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
    /// @param _l2TxNumberInBlock The L2 transaction number in a block, in which the log was sent
    /// @param _merkleProof The Merkle proof of the processing L1 -> L2 transaction with deposit finalization
    function claimFailedDeposit(
        address _depositSender,
        address _l1Token,
        bytes32 _l2TxHash,
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBlock,
        bytes32[] calldata _merkleProof
    ) external;

    /// @notice Finalize the withdrawal and release funds
    /// @param _l2BlockNumber The L2 block number where the withdrawal was processed
    /// @param _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
    /// @param _l2TxNumberInBlock The L2 transaction number in a block, in which the log was sent
    /// @param _message The L2 withdraw data, stored in an L2 -> L1 message
    /// @param _merkleProof The Merkle proof of the inclusion L2 -> L1 message about withdrawal initialization
    function finalizeWithdrawal(
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBlock,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) external;

    /// @notice The L2 token address that will be minted for deposit of the given L1 token
    function l2TokenAddress(address _l1Token) external view returns (address);

    /// @notice The address of deployed L2 bridge counterpart
    function l2Bridge() external view returns (address);
}
