// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {IL2TokenGateway} from "./interfaces/IL2TokenGateway.sol";
import {IERC20Ownable} from "../token/interfaces/IERC20Ownable.sol";

import {L2CrossDomainEnabled} from "./L2CrossDomainEnabled.sol";
import {L2OutboundDataParser} from "./libraries/L2OutboundDataParser.sol";
import {InterchainERC20TokenGateway} from "./InterchainERC20TokenGateway.sol";

/// @author psirex
/// @notice Contract implements ITokenGateway interface and with counterpart L1ERC20TokenGateway
///     allows bridging registered ERC20 compatible tokens between Arbitrum and Ethereum chains
contract L2ERC20TokenGateway is
    InterchainERC20TokenGateway,
    L2CrossDomainEnabled,
    IL2TokenGateway
{
    /// @param arbSys_ Address of the Arbitrum’s ArbSys contract in the L2 chain
    /// @param router_ Address of the router in the L2 chain
    /// @param counterpartGateway_ Address of the counterpart L1 gateway
    /// @param l1Token_ Address of the bridged token in the L1 chain
    /// @param l2Token_ Address of the token minted on the Arbitrum chain when token bridged
    constructor(
        address arbSys_,
        address router_,
        address counterpartGateway_,
        address l1Token_,
        address l2Token_
    )
        InterchainERC20TokenGateway(
            router_,
            counterpartGateway_,
            l1Token_,
            l2Token_
        )
        L2CrossDomainEnabled(arbSys_)
    {}

    /// @notice Initiates the withdrawing process from the Arbitrum chain into the Ethereum chain
    /// @param l1Token_ Address in the L1 chain of the token to withdraw
    /// @param to_ Address of the recipient of the token on the corresponding chain
    /// @param amount_ Amount of tokens to bridge
    /// @param data_ Additional data required for transaction
    function outboundTransfer(
        address l1Token_,
        address to_,
        uint256 amount_,
        uint256, // maxGas
        uint256, // gasPriceBid
        bytes memory data_
    )
        external
        whenWithdrawalsEnabled
        onlySupportedL1Token(l1Token_)
        returns (bytes memory res)
    {
        address from = L2OutboundDataParser.decode(router, data_);
        IERC20Ownable(l2Token).burn(from, amount_);
        uint256 id = sendCrossDomainMessage(
            counterpartGateway,
            getOutboundCalldata(l1Token_, from, to_, amount_)
        );
        emit WithdrawalInitiated(l1Token_, from, to_, id, 0, amount_);
        return abi.encode(id);
    }

    /// @notice Finalizes the bridging from the Ethereum chain
    /// @param l1Token_ Address in the L1 chain of the token to bridge
    /// @param from_ Address of the account initiated bridging
    /// @param to_ Address of the recipient of the tokens
    /// @param amount_ Amount of tokens to bridge
    function finalizeInboundTransfer(
        address l1Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes calldata
    )
        external
        onlySupportedL1Token(l1Token_)
        onlyFromCrossDomainAccount(counterpartGateway)
    {
        IERC20Ownable(l2Token).mint(to_, amount_);
        emit DepositFinalized(l1Token_, from_, to_, amount_);
    }
}
