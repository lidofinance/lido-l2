// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IZkSync, IMailbox, L2Log, L2Message, TxStatus} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {IL2Bridge} from "@matterlabs/zksync-contracts/l1/contracts/bridge/interfaces/IL2Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";

import {IL2ContractDeployer} from "@matterlabs/zksync-contracts/l1/contracts/common/interfaces/IL2ContractDeployer.sol";
import {UnsafeBytes} from "@matterlabs/zksync-contracts/l1/contracts/common/libraries/UnsafeBytes.sol";
import {L2ContractHelper} from "@matterlabs/zksync-contracts/l1/contracts/common/libraries/L2ContractHelper.sol";
import {ReentrancyGuard} from "@matterlabs/zksync-contracts/l1/contracts/common/ReentrancyGuard.sol";
import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l1/contracts/vendor/AddressAliasHelper.sol";
import {BridgeInitializationHelper} from "@matterlabs/zksync-contracts/l1/contracts/bridge/libraries/BridgeInitializationHelper.sol";
import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";

import {BridgeableTokensUpgradable} from "../../common/BridgeableTokensUpgradable.sol";
import {BridgingManager} from "../../common/BridgingManager.sol";

/// @notice Smart contract that allows depositing wstETH tokens from Ethereum to zkSync v2.0
/// @dev It is standard implementation of wstETH Bridge that can be used as a reference
/// for any other custom token bridges.
contract L1ERC20Bridge is
    IL1ERC20Bridge,
    BridgeableTokensUpgradable,
    BridgingManager,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    /// @dev zkSync smart contract that is used to operate with L2 via asynchronous L2 <-> L1 communication
    IZkSync public immutable zkSync;

    /// @dev A mapping L2 block number => message number => flag
    /// @dev Used to indicate that zkSync L2 -> L1 message was already processed
    mapping(uint256 => mapping(uint256 => bool)) public isWithdrawalFinalized;

    /// @dev A mapping account => L1 token address => L2 deposit transaction hash => amount
    /// @dev Used for saving the number of deposited funds, to claim them in case the deposit transaction will fail
    mapping(address => mapping(bytes32 => uint256)) public depositAmount;

    /// @inheritdoc IL1ERC20Bridge
    address public l2Bridge;

    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Disable the initialization to prevent Parity hack.
    constructor(IZkSync zkSync_) {
        zkSync = zkSync_;
    }

    /// @inheritdoc IL1ERC20Bridge
    function initialize(
        bytes[] calldata _factoryDeps,
        address l1Token_,
        address l2Token_,
        address _governor,
        uint256 _deployBridgeImplementationFee,
        uint256 _deployBridgeProxyFee
    ) external payable initializer reentrancyGuardInitializer {
        require(_governor != address(0), "The governor address can't be zero");
        require(
            _factoryDeps.length == 2,
            "Invalid factory deps length provided"
        );
        require(
            msg.value == _deployBridgeImplementationFee + _deployBridgeProxyFee,
            "The caller miscalculated deploy transactions fees"
        );
        __BridgeableTokens_init(l1Token_, l2Token_);

        bytes32 l2BridgeImplementationBytecodeHash = L2ContractHelper
            .hashL2Bytecode(_factoryDeps[0]);
        bytes32 l2BridgeProxyBytecodeHash = L2ContractHelper.hashL2Bytecode(
            _factoryDeps[1]
        );

        // Deploy L2 bridge implementation contract
        address bridgeImplementationAddr = BridgeInitializationHelper
            .requestDeployTransaction(
                zkSync,
                _deployBridgeImplementationFee,
                l2BridgeImplementationBytecodeHash,
                "", // Empty constructor data
                _factoryDeps // All factory deps are needed for L2 bridge
            );

        // Prepare the proxy constructor data
        bytes memory l2BridgeProxyConstructorData;
        {
            // Data to be used in delegate call to initialize the proxy
            bytes memory proxyInitializationParams = abi.encodeCall(
                IL2ERC20Bridge.initialize,
                (address(this), l1Token, l2Token)
            );
            l2BridgeProxyConstructorData = abi.encode(
                bridgeImplementationAddr,
                _governor,
                proxyInitializationParams
            );
        }
        // Deploy L2 bridge proxy contract
        l2Bridge = BridgeInitializationHelper.requestDeployTransaction(
            zkSync,
            _deployBridgeProxyFee,
            l2BridgeProxyBytecodeHash,
            l2BridgeProxyConstructorData,
            new bytes[](0) // No factory deps are needed for L2 bridge proxy, because it is already passed in previous step
        );
    }

    /// @inheritdoc IL1ERC20Bridge
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte
    ) external payable returns (bytes32 l2TxHash) {
        l2TxHash = deposit(
            _l2Receiver,
            _l1Token,
            _amount,
            _l2TxGasLimit,
            _l2TxGasPerPubdataByte,
            address(0)
        );
    }

    /// @inheritdoc IL1ERC20Bridge
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte,
        address _refundRecipient
    )
        public
        payable
        nonReentrant
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
        returns (bytes32 l2TxHash)
    {
        require(
            _l2Receiver != address(0),
            "The _l2Receiver address can't be zero"
        );

        require(_amount != 0, "The deposit amount can't be zero");

        uint256 amount = _depositFunds(msg.sender, IERC20(_l1Token), _amount);

        require(amount == _amount, "The token has non-standard transfer logic");

        bytes memory l2TxCalldata = _getDepositL2Calldata(
            msg.sender,
            _l2Receiver,
            _l1Token,
            amount
        );

        // If the refund recipient is not specified, the refund will be sent to the sender of the transaction.
        // Otherwise, the refund will be sent to the specified address.
        // Please note, if the recipient is a contract (the only exception is a contracting contract, but it is a shot in the leg).
        address refundRecipient = _refundRecipient;
        if (_refundRecipient == address(0)) {
            refundRecipient = msg.sender != tx.origin
                ? AddressAliasHelper.applyL1ToL2Alias(msg.sender)
                : msg.sender;
        }
        l2TxHash = zkSync.requestL2Transaction{value: msg.value}(
            l2Bridge,
            0, // L2 msg.value
            l2TxCalldata,
            _l2TxGasLimit,
            _l2TxGasPerPubdataByte,
            new bytes[](0),
            refundRecipient
        );

        // Save the deposited amount to claim funds on L1 if the deposit failed on L2
        depositAmount[msg.sender][l2TxHash] = amount;

        emit DepositInitiated(
            l2TxHash,
            msg.sender,
            _l2Receiver,
            _l1Token,
            amount,
            refundRecipient
        );
    }

    /// @dev Transfers tokens from the depositor address to the smart contract address
    /// @return The difference between the contract balance before and after the transferring of funds
    function _depositFunds(
        address _from,
        IERC20 _token,
        uint256 _amount
    ) internal returns (uint256) {
        uint256 balanceBefore = _token.balanceOf(address(this));
        _token.safeTransferFrom(_from, address(this), _amount);
        uint256 balanceAfter = _token.balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

    /// @dev Generate a calldata for calling the deposit finalization on the L2 bridge contract
    function _getDepositL2Calldata(
        address _l1Sender,
        address _l2Receiver,
        address _l1Token,
        uint256 _amount
    ) internal pure returns (bytes memory txCalldata) {
        txCalldata = abi.encodeCall(
            IL2Bridge.finalizeDeposit,
            (_l1Sender, _l2Receiver, _l1Token, _amount, "")
        );
    }

    /// @inheritdoc IL1ERC20Bridge
    function claimFailedDeposit(
        address _depositSender,
        address _l1Token,
        bytes32 _l2TxHash,
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBlock,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        bool proofValid = zkSync.proveL1ToL2TransactionStatus(
            _l2TxHash,
            _l2BlockNumber,
            _l2MessageIndex,
            _l2TxNumberInBlock,
            _merkleProof,
            TxStatus.Failure
        );
        require(proofValid, "The proof is not valid");

        uint256 amount = depositAmount[_depositSender][_l2TxHash];
        require(amount > 0, "The claimed amount can't be zero");

        delete depositAmount[_depositSender][_l2TxHash];

        IERC20(_l1Token).safeTransfer(_depositSender, amount);

        emit ClaimedFailedDeposit(_depositSender, _l1Token, amount);
    }

    /// @inheritdoc IL1ERC20Bridge
    function finalizeWithdrawal(
        uint256 _l2BlockNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBlock,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) external nonReentrant whenWithdrawalsEnabled {
        require(
            !isWithdrawalFinalized[_l2BlockNumber][_l2MessageIndex],
            "Withdrawal is already finalized"
        );

        (
            address l1Receiver_,
            address l1Token_,
            uint256 amount_
        ) = _parseL2WithdrawalMessage(_message);

        // @dev struct L2Message
        L2Message memory l2ToL1Message = L2Message({
            txNumberInBlock: _l2TxNumberInBlock,
            sender: l2Bridge,
            data: _message
        });

        // Preventing the stack too deep error
        {
            // prove that the message was sent to L1 and included in a zkSync block
            bool success = zkSync.proveL2MessageInclusion(
                _l2BlockNumber,
                _l2MessageIndex,
                l2ToL1Message,
                _merkleProof
            );

            require(success, "Proving message inclusion failed");
        }

        isWithdrawalFinalized[_l2BlockNumber][_l2MessageIndex] = true;

        IERC20(l1Token).safeTransfer(l1Receiver_, amount_);

        emit WithdrawalFinalized(l1Receiver_, l1Token_, amount_);
    }

    /// @dev Decode the withdraw message that came from L2
    function _parseL2WithdrawalMessage(
        bytes memory _l2ToL1message
    )
        internal
        pure
        returns (address l1Receiver_, address l1Token_, uint256 amount_)
    {
        // Check that the message length is correct.
        // It should be equal to the length of the function selector + address + address + uint256 = 4 + 20 + 20 + 32 = 76 (bytes).
        require(_l2ToL1message.length == 76, "Invalid length of the message");

        (uint32 functionSelector, uint256 offset) = UnsafeBytes.readUint32(
            _l2ToL1message,
            0
        );
        require(
            bytes4(functionSelector) == this.finalizeWithdrawal.selector,
            "Non-matching function selectors"
        );

        (l1Receiver_, offset) = UnsafeBytes.readAddress(_l2ToL1message, offset);
        (l1Token_, offset) = UnsafeBytes.readAddress(_l2ToL1message, offset);
        (amount_, offset) = UnsafeBytes.readUint256(_l2ToL1message, offset);
    }

    /// @inheritdoc IL1ERC20Bridge
    function l2TokenAddress(
        address _l1Token
    ) public view returns (address l2TokenAddr) {
        l2TokenAddr = _l1Token == l1Token ? l2Token : address(0);
    }
}
