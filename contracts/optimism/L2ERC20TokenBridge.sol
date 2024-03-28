// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";
import {IERC20Bridged} from "../token/interfaces/IERC20Bridged.sol";
import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";
import {IERC20Wrapper} from "../token/interfaces/IERC20Wrapper.sol";

import {ERC20Rebasable} from "../token/ERC20Rebasable.sol";
import {BridgingManager} from "../BridgingManager.sol";
import {RebasableAndNonRebasableTokens} from "./RebasableAndNonRebasableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {DepositDataCodec} from "./DepositDataCodec.sol";

/// @author psirex
/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. It acts as a minter for new tokens when it hears about
///     deposits into the L1 token bridge. It also acts as a burner of the tokens
///     intended for withdrawal, informing the L1 bridge to release L1 funds. Additionally, adds
///     the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2ERC20TokenBridge is
    IL2ERC20Bridge,
    BridgingManager,
    RebasableAndNonRebasableTokens,
    CrossDomainEnabled,
    DepositDataCodec
{
    using SafeERC20 for IERC20;

    address public immutable L1_TOKEN_BRIDGE;

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
        address l2TokenRebasable_
    ) CrossDomainEnabled(messenger_) RebasableAndNonRebasableTokens(l1TokenNonRebasable_, l1TokenRebasable_, l2TokenNonRebasable_, l2TokenRebasable_) {
        L1_TOKEN_BRIDGE = l1TokenBridge_;
    }

    /// @inheritdoc IL2ERC20Bridge
    function l1TokenBridge() external view returns (address) {
        return L1_TOKEN_BRIDGE;
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
        onlyFromCrossDomainAccount(L1_TOKEN_BRIDGE)
    {
        if (_isRebasableTokenFlow(l1Token_, l2Token_)) {
            DepositData memory depositData = decodeDepositData(data_);
            ITokenRateOracle tokenRateOracle = ERC20Rebasable(L2_TOKEN_REBASABLE).TOKEN_RATE_ORACLE();
            tokenRateOracle.updateRate(depositData.rate, depositData.timestamp);

            ERC20Rebasable(L2_TOKEN_REBASABLE).mintShares(to_, amount_);

            uint256 rebasableTokenAmount = ERC20Rebasable(L2_TOKEN_REBASABLE).getTokensByShares(amount_);
            emit DepositFinalized(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                from_,
                to_,
                rebasableTokenAmount,
                depositData.data
            );
        } else if (_isNonRebasableTokenFlow(l1Token_, l2Token_)) {
            IERC20Bridged(L2_TOKEN_NON_REBASABLE).bridgeMint(to_, amount_);
            emit DepositFinalized(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                from_,
                to_,
                amount_,
                data_
            );
        }
    }

    function _withdrawTo(
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) internal {
        if (l2Token_ == L2_TOKEN_REBASABLE) {
            uint256 shares = ERC20Rebasable(L2_TOKEN_REBASABLE).getSharesByTokens(amount_);
            ERC20Rebasable(L2_TOKEN_REBASABLE).burnShares(msg.sender, shares);

            _initiateWithdrawal(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                msg.sender,
                to_,
                shares,
                l1Gas_,
                data_
            );
            emit WithdrawalInitiated(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                msg.sender,
                to_,
                amount_,
                data_
            );
        } else if (l2Token_ == L2_TOKEN_NON_REBASABLE) {
            IERC20Bridged(L2_TOKEN_NON_REBASABLE).bridgeBurn(msg.sender, amount_);

            _initiateWithdrawal(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                msg.sender,
                to_,
                amount_,
                l1Gas_,
                data_
            );
            emit WithdrawalInitiated(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                msg.sender,
                to_,
                amount_,
                data_
            );
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

        sendCrossDomainMessage(L1_TOKEN_BRIDGE, l1Gas_, message);
    }
}
