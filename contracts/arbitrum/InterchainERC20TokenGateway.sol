// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";

import {IInterchainTokenGateway} from "./interfaces/IInterchainTokenGateway.sol";

/// @author psirex
/// @notice The contract keeps logic shared among both L1 and L2 gateways, adding the methods for
///     bridging management: enabling and disabling withdrawals/deposits
abstract contract InterchainERC20TokenGateway is
    BridgingManager,
    BridgeableTokens,
    IInterchainTokenGateway
{
    /// @notice Address of the router in the corresponding chain
    address public immutable router;

    /// @inheritdoc IInterchainTokenGateway
    address public immutable counterpartGateway;

    /// @param router_ Address of the router in the corresponding chain
    /// @param counterpartGateway_ Address of the counterpart gateway used in the bridging process
    /// @param l1TokenNonRebasable Address of the bridged token in the Ethereum chain
    /// @param l1TokenRebasable_ Address of the bridged token in the Ethereum chain
    /// @param l2TokenNonRebasable_ Address of the token minted on the Arbitrum chain when token bridged
    /// @param l2TokenRebasable_ Address of the token minted on the Arbitrum chain when token bridged
    constructor(
        address router_,
        address counterpartGateway_,
        address l1TokenNonRebasable,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) BridgeableTokens(l1TokenNonRebasable, l1TokenRebasable_, l2TokenNonRebasable_, l2TokenRebasable_) {
        router = router_;
        counterpartGateway = counterpartGateway_;
    }

    /// @inheritdoc IInterchainTokenGateway
    /// @dev The current implementation returns the l2Token address when passed l1Token_ equals
    ///     to l1Token declared in the contract and address(0) in other cases
    function calculateL2TokenAddress(address l1Token_)
        external
        view
        returns (address)
    {
        if (l1Token_ == l1TokenRebasable) {
            return l2TokenNonRebasable;
        }
        return address(0);
    }

    /// @inheritdoc IInterchainTokenGateway
    function getOutboundCalldata(
        address l1Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes memory // data_
    ) public pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IInterchainTokenGateway.finalizeInboundTransfer.selector,
                l1Token_,
                from_,
                to_,
                amount_,
                ""
            );
    }
}
