// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1TokenGateway} from "../interfaces/IL1TokenGateway.sol";
import {InterchainTokensGateway} from "./InterchainTokensGateway.sol";
import {L1OutboundDataParser} from "../libraries/L1OutboundDataParser.sol";
import {L1CrossDomainEnabled} from "./L1CrossDomainEnabled.sol";

contract L1TokensGateway is
    InterchainTokensGateway,
    L1CrossDomainEnabled,
    IL1TokenGateway
{
    using SafeERC20 for IERC20;

    constructor(
        address inbox_,
        address router_,
        address counterpartGateway_,
        address l1Token_,
        address l2Token_
    )
        InterchainTokensGateway(
            router_,
            counterpartGateway_,
            l1Token_,
            l2Token_
        )
        L1CrossDomainEnabled(inbox_)
    {}

    function outboundTransfer(
        address l1Token_,
        address to,
        uint256 amount,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    )
        external
        payable
        whenDepositsEnabled
        onlyL1Token(l1Token_)
        returns (bytes memory res)
    {
        (address from, uint256 maxSubmissionCost) = L1OutboundDataParser.decode(
            router,
            data
        );
        IERC20(l1Token_).safeTransferFrom(from, address(this), amount);
        res = abi.encode(
            sendCrossDomainMessage(
                counterpartGateway,
                getOutboundCalldata(l1Token, from, to, amount),
                CrossDomainMessageOptions({
                    maxGas: maxGas,
                    callValue: 0,
                    gasPriceBid: gasPriceBid,
                    refundAddress: from,
                    maxSubmissionCost: maxSubmissionCost
                })
            )
        );
        emit DepositInitiated(
            l1Token,
            from,
            to,
            abi.decode(res, (uint256)),
            amount
        );
    }

    function finalizeInboundTransfer(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes calldata
    )
        external
        onlyL1Token(token)
        onlyFromCrossDomainAccount(counterpartGateway)
    {
        IERC20(l1Token).safeTransfer(to, amount);
        emit WithdrawalFinalized(l1Token, from, to, 0, amount);
    }

    error ErrorNotFromBridge();
}
