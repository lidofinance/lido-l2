// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1TokenGateway} from "./interfaces/IL1TokenGateway.sol";

import {L1CrossDomainEnabled} from "./L1CrossDomainEnabled.sol";
import {L1OutboundDataParser} from "./libraries/L1OutboundDataParser.sol";
import {InterchainERC20TokenGateway} from "./InterchainERC20TokenGateway.sol";

/// @author psirex
/// @notice Contract implements ITokenGateway interface and with counterpart L2ERC20TokenGatewy
///     allows bridging registered ERC20 compatible tokens between Ethereum and Arbitrum chains
contract L1ERC20TokenGateway is
    InterchainERC20TokenGateway,
    L1CrossDomainEnabled,
    IL1TokenGateway
{
    using SafeERC20 for IERC20;

    /// @param inbox_ Address of the Arbitrum’s Inbox contract in the L1 chain
    /// @param router_ Address of the router in the L1 chain
    /// @param counterpartGateway_ Address of the counterpart L2 gateway
    /// @param l1Token_ Address of the bridged token in the L1 chain
    /// @param l2Token_ Address of the token minted on the Arbitrum chain when token bridged
    constructor(
        address inbox_,
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
        L1CrossDomainEnabled(inbox_)
    {}

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
    )
        external
        payable
        whenDepositsEnabled
        onlySupportedL1Token(l1Token_)
        returns (bytes memory res)
    {
        (address from, uint256 maxSubmissionCost) = L1OutboundDataParser.decode(
            router,
            data_
        );
        IERC20(l1Token_).safeTransferFrom(from, address(this), amount_);
        res = abi.encode(
            sendCrossDomainMessage(
                counterpartGateway,
                getOutboundCalldata(l1Token, from, to_, amount_),
                CrossDomainMessageOptions({
                    maxGas: maxGas_,
                    callValue: 0,
                    gasPriceBid: gasPriceBid_,
                    refundAddress: from,
                    maxSubmissionCost: maxSubmissionCost
                })
            )
        );
        emit DepositInitiated(
            l1Token,
            from,
            to_,
            abi.decode(res, (uint256)),
            amount_
        );
    }

    /// @notice Finalizes the withdrawal of the tokens from the L2 chain
    /// @param l1Token_ Address in the L1 chain of the token to withdraw
    /// @param from_ Address of the account initiated withdrawing
    /// @param to_ Address of the recipient of the tokens
    /// @param amount_ Amount of tokens to withdraw
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
        IERC20(l1Token_).safeTransfer(to_, amount_);
        emit WithdrawalFinalized(l1Token_, from_, to_, 0, amount_);
    }

    error ErrorNotFromBridge();
}
