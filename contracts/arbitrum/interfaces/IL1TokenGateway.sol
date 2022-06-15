// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.4.21;

import {IInterchainTokenGateway} from "./IInterchainTokenGateway.sol";

/// @author psirex
/// @notice L1 part of the tokens bridge compatible with Arbitrum's GatewayRouter
interface IL1TokenGateway is IInterchainTokenGateway {
    /// @notice Initiates the tokens bridging from the Ethereum into the Arbitrum chain
    /// @dev L2 address alias will not be applied to the following types of addresses on L1:
    ///    - an externally-owned account
    ///    - a contract in construction
    ///    - an address where a contract will be created
    ///    - an address where a contract lived, but was destroyed
    /// @param l1Token_ L1 address of ERC20
    /// @param refundTo_ Account, or its L2 alias if it have code in L1 to be credited with
    ///    excess gas refund in L2
    /// @param to_ Account to be credited with the tokens in the L2 (can be the user's L2 account
    ///    or a contract), not subject to L2 aliasing. This account, or its L2 alias if it have
    ///    code in L1, will also be able to cancel the retryable ticket and receive
    ///    callvalue refund
    /// @param amount_ Token Amount
    /// @param maxGas_ Max gas deducted from user's L2 balance to cover L2 execution
    /// @param gasPriceBid_ Gas price for L2 execution
    /// @param data_ encoded data from router and user
    /// @return abi encoded inbox sequence number
    function outboundTransferCustomRefund(
        address l1Token_,
        address refundTo_,
        address to_,
        uint256 amount_,
        uint256 maxGas_,
        uint256 gasPriceBid_,
        bytes calldata data_
    ) external payable returns (bytes memory);

    /// @notice Initiates the tokens bridging from the Ethereum into the Arbitrum chain
    /// @param l1Token_ Address in the L1 chain of the token to bridge
    /// @param to_ Address of the recipient of the token on the corresponding chain
    /// @param amount_ Amount of tokens to bridge
    /// @param maxGas_ Gas limit for immediate L2 execution attempt
    /// @param gasPriceBid_ L2 gas price bid for immediate L2 execution attempt
    /// @param data_ Additional data required for the transaction
    function outboundTransfer(
        address l1Token_,
        address to_,
        uint256 amount_,
        uint256 maxGas_,
        uint256 gasPriceBid_,
        bytes calldata data_
    ) external payable returns (bytes memory);

    event DepositInitiated(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed sequenceNumber,
        uint256 amount
    );

    event WithdrawalFinalized(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed exitNum,
        uint256 amount
    );
}
