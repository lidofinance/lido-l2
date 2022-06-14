// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.4.21;

/// @author psirex
/// @notice Keeps logic shared among both L1 and L2 gateways.
interface IInterchainTokenGateway {
    /// @notice Finalizes the bridging of the tokens between chains
    /// @param l1Token_ Address in the L1 chain of the token to withdraw
    /// @param from_ Address of the account initiated withdrawing
    /// @param to_ Address of the recipient of the tokens
    /// @param amount_ Amount of tokens to withdraw
    /// @param data_ Additional data required for the transaction
    function finalizeInboundTransfer(
        address l1Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes calldata data_
    ) external;

    /// @notice Calculates address of token, which will be minted on the Arbitrum chain,
    ///     on l1Token_ bridging
    /// @param l1Token_ Address of the token on the Ethereum chain
    /// @return Address of the token minted on the L2 on bridging
    function calculateL2TokenAddress(address l1Token_)
        external
        view
        returns (address);

    /// @notice Returns address of the counterpart gateway used in the bridging process
    function counterpartGateway() external view returns (address);

    /// @notice Returns encoded transaction data to send into the counterpart gateway to finalize
    ///     the tokens bridging process.
    /// @param l1Token_ An address in the Ethereum chain of the token to bridge
    /// @param from_ An address of the account initiated bridging in the current chain
    /// @param to_ An address of the recipient of the token in the counterpart chain
    /// @param amount_  An amount of tokens to bridge
    /// @return An encoded transaction data of finalizeInboundTransfer call
    function getOutboundCalldata(
        address l1Token_,
        address from_,
        address to_,
        uint256 amount_
    ) external view returns (bytes memory);
}
