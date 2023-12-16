// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";
import {IERC20Bridged} from "../token/interfaces/IERC20Bridged.sol";
import {ITokensRateOracle} from "../token/interfaces/ITokensRateOracle.sol";
import {ERC20Rebasable} from "../token/ERC20Rebasable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Wrapable} from "../token/interfaces/IERC20Wrapable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokensOptimism} from "./BridgeableTokensOptimism.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {DepositDataCodec} from "./DepositDataCodec.sol";

import { console } from "hardhat/console.sol";

/// @author psirex
/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. It acts as a minter for new tokens when it hears about
///     deposits into the L1 token bridge. It also acts as a burner of the tokens
///     intended for withdrawal, informing the L1 bridge to release L1 funds. Additionally, adds
///     the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2ERC20TokenBridge is
    IL2ERC20Bridge,
    BridgingManager,
    BridgeableTokensOptimism,
    CrossDomainEnabled,
    DepositDataCodec
{
    using SafeERC20 for IERC20;

    /// @inheritdoc IL2ERC20Bridge
    address public immutable l1TokenBridge;

    address public immutable tokensRateOracle;

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l1TokenBridge_  Address of the corresponding L1 bridge
    /// @param l1TokenNonRebasable_ Address of the bridged token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the token minted on the L2 chain when token bridged
    constructor(
        address messenger_,
        address l1TokenBridge_,
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_,
        address tokensRateOracle_
    ) CrossDomainEnabled(messenger_) BridgeableTokensOptimism(l1TokenNonRebasable_, l1TokenRebasable_, l2TokenNonRebasable_, l2TokenRebasable_) {
        l1TokenBridge = l1TokenBridge_;
        tokensRateOracle = tokensRateOracle_;
    }

    /// @inheritdoc IL2ERC20Bridge
    function withdraw(
        address l2Token_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) external whenWithdrawalsEnabled onlySupportedL2Token(l2Token_) {
        _withdrawTo(l2Token_, msg.sender, amount_, l1Gas_, data_);
    }

    /// @inheritdoc IL2ERC20Bridge
    function withdrawTo(
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) external whenWithdrawalsEnabled onlySupportedL2Token(l2Token_) {        
        _withdrawTo(l2Token_, to_, amount_, l1Gas_, data_);
    }

    function _withdrawTo(
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) internal {
        if (l2Token_ == l2TokenRebasable) {
            // maybe loosing 1 wei her as well
            uint256 shares = ERC20Rebasable(l2TokenRebasable).getSharesByTokens(amount_);
            ERC20Rebasable(l2TokenRebasable).burnShares(msg.sender, shares);
            _initiateWithdrawal(l1TokenRebasable, l2TokenRebasable, msg.sender, to_, shares, l1Gas_, data_);
        } else if (l2Token_ == l2TokenNonRebasable) {
            IERC20Bridged(l2TokenNonRebasable).bridgeBurn(msg.sender, amount_);
            _initiateWithdrawal(l1TokenNonRebasable, l2TokenNonRebasable, msg.sender, to_, amount_, l1Gas_, data_);
        }
    }

    /// @inheritdoc IL2ERC20Bridge
    function finalizeDeposit(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes calldata data_
    )
        external
        whenDepositsEnabled
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
        onlyFromCrossDomainAccount(l1TokenBridge)
    {
        if (isRebasableTokenFlow(l1Token_, l2Token_)) {
            DepositData memory depositData = decodeDepositData(data_);
            ITokensRateOracle(tokensRateOracle).updateRate(int256(depositData.rate), depositData.time);
            ERC20Rebasable(l2TokenRebasable).mintShares(to_, amount_);
            emit DepositFinalized(l1Token_, l2Token_, from_, to_, amount_, depositData.data);
        } else if (isNonRebasableTokenFlow(l1Token_, l2Token_)) {
            IERC20Bridged(l2TokenNonRebasable).bridgeMint(to_, amount_);
            emit DepositFinalized(l1Token_, l2Token_, from_, to_, amount_, data_);
        }
    }

    /// @notice Performs the logic for withdrawals by burning the token and informing
    ///     the L1 token Gateway of the withdrawal
    /// @param from_ Account to pull the withdrawal from on L2
    /// @param to_ Account to give the withdrawal to on L1
    /// @param amount_ Amount of the token to withdraw
    /// @param l1Gas_ Unused, but included for potential forward compatibility considerations
    /// @param data_ Optional data to forward to L1. This data is provided
    ///     solely as a convenience for external contracts. Aside from enforcing a maximum
    ///     length, these contracts provide no guarantees about its content
    function _initiateWithdrawal(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes memory data_
    ) internal {

        bytes memory message = abi.encodeWithSelector(
            IL1ERC20Bridge.finalizeERC20Withdrawal.selector,
            l1Token_,
            l2Token_,
            from_,
            to_,
            amount_,
            data_
        );

        sendCrossDomainMessage(l1TokenBridge, l1Gas_, message);

        emit WithdrawalInitiated(l1Token_, l2Token_, from_, to_, amount_, data_);
    }
}
