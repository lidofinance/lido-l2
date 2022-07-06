// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IInterchainTokenGateway} from "./IInterchainTokenGateway.sol";

/// @author psirex
/// @notice L2 part of the tokens bridge compatible with Arbitrum's GatewayRouter
interface IL2TokenGateway is IInterchainTokenGateway {
    /// @notice Initiates the withdrawing process from the Arbitrum chain into the Ethereum chain
    /// @param l1Token_ Address in the L1 chain of the token to withdraw
    /// @param to_ Address of the recipient of the token on the corresponding chain
    /// @param amount_ Amount of tokens to bridge
    /// @param data_ Additional data required for transaction
    function outboundTransfer(
        address l1Token_,
        address to_,
        uint256 amount_,
        uint256 maxGas_,
        uint256 gasPriceBid_,
        bytes calldata data_
    ) external returns (bytes memory);

    event DepositFinalized(
        address indexed l1Token,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event WithdrawalInitiated(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed l2ToL1Id,
        uint256 exitNum,
        uint256 amount
    );
}
