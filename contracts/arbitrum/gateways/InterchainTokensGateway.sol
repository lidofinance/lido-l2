// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {BridgingManager} from "../../BridgingManager.sol";
import {ITokenGatewayCommon} from "../interfaces/ITokenGatewayCommon.sol";

abstract contract InterchainTokensGateway is
    BridgingManager,
    ITokenGatewayCommon
{
    address public immutable l1Token;
    address public immutable l2Token;
    address public immutable counterpartGateway;
    address public immutable router;

    constructor(
        address router_,
        address counterpartGateway_,
        address l1Token_,
        address l2Token_
    ) {
        router = router_;
        counterpartGateway = counterpartGateway_;
        l1Token = l1Token_;
        l2Token = l2Token_;
    }

    function calculateL2TokenAddress(address l1ERC20)
        external
        view
        returns (address)
    {
        if (l1ERC20 == l1Token) {
            return l2Token;
        }
        return address(0);
    }

    function getOutboundCalldata(
        address token,
        address from,
        address to,
        uint256 amount
    ) public pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                ITokenGatewayCommon.finalizeInboundTransfer.selector,
                token,
                from,
                to,
                amount,
                ""
            );
    }

    modifier onlyL1Token(address token) {
        if (token != l1Token) {
            revert ErrorWrongToken();
        }
        _;
    }

    error ErrorWrongToken();
}
