// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";

import {ITokenGatewayCommon} from "./interfaces/ITokenGatewayCommon.sol";

/// @author psirex
/// @title Shared L1/L2 gateway logic
/// @notice The contract keeps logic shared among both L1 and L2 gateways.
abstract contract InterchainTokensGateway is
    BridgingManager,
    BridgeableTokens,
    ITokenGatewayCommon
{
    /// @notice An address of the router in the corresponding chain
    address public immutable router;

    /// @notice An address of the counterpart gateway used in the bridging process
    address public immutable counterpartGateway;

    /// @param router_ An address of the router in the corresponding chain
    /// @param counterpartGateway_ An address of the counterpart gateway used in the bridging process
    /// @param l1Token_ An address of the bridged token in the Ethereum chain
    /// @param l2Token_ An address of the token minted on the Arbitrum chain when token bridged
    constructor(
        address router_,
        address counterpartGateway_,
        address l1Token_,
        address l2Token_
    ) BridgeableTokens(l1Token_, l2Token_) {
        router = router_;
        counterpartGateway = counterpartGateway_;
    }

    /// @notice Calculates an address of token, which will be minted on the Arbitrum chain,
    ///     on l1Token_ bridging.
    /// @dev The current implementation returns the l2Token address when passed l1Token_ equals
    ///     to l1Token declared in the contract and address(0) in other cases.
    /// @param l1Token_ An address of the token on the Ethereum chain
    function calculateL2TokenAddress(address l1Token_)
        external
        view
        returns (address)
    {
        if (l1Token_ == l1Token) {
            return l2Token;
        }
        return address(0);
    }

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
    ) public pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                ITokenGatewayCommon.finalizeInboundTransfer.selector,
                l1Token_,
                from_,
                to_,
                amount_,
                ""
            );
    }
}
