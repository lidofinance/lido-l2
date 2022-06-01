// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IL2TokenGateway} from "../interfaces/IL2TokenGateway.sol";
import {InterchainTokensGateway} from "./InterchainTokensGateway.sol";

import {IERC20Ownable} from "../../token/interfaces/IERC20Ownable.sol";
import {L2OutboundDataParser} from "../libraries/L2OutboundDataParser.sol";
import {L2CrossDomainEnabled} from "./L2CrossDomainEnabled.sol";

contract L2TokensGateway is
    InterchainTokensGateway,
    L2CrossDomainEnabled,
    IL2TokenGateway
{
    constructor(
        address arbSys_,
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
        L2CrossDomainEnabled(arbSys_)
    {}

    function outboundTransfer(
        address l1Token_,
        address to,
        uint256 amount,
        uint256, // maxGas
        uint256, // gasPriceBid
        bytes memory _data
    )
        external
        whenWithdrawalsEnabled
        onlyL1Token(l1Token_)
        returns (bytes memory res)
    {
        address from = L2OutboundDataParser.decode(router, _data);
        IERC20Ownable(l2Token).burn(from, amount);
        uint256 id = sendCrossDomainMessage(
            counterpartGateway,
            getOutboundCalldata(l1Token, from, to, amount)
        );
        emit WithdrawalInitiated(l1Token, from, to, id, 0, amount);
        return abi.encode(id);
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
        IERC20Ownable(l2Token).mint(to, amount);
        emit DepositFinalized(l1Token, from, to, amount);
    }
}
