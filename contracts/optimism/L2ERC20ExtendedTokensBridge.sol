// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";
import {IERC20Bridged} from "../token/ERC20Bridged.sol";
import {ITokenRateUpdatable} from "../optimism/interfaces/ITokenRateUpdatable.sol";
import {ERC20RebasableBridged} from "../token/ERC20RebasableBridged.sol";
import {BridgingManager} from "../BridgingManager.sol";
import {RebasableAndNonRebasableTokens} from "./RebasableAndNonRebasableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {DepositDataCodec} from "../lib/DepositDataCodec.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author psirex, kovalgek
/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. It acts as a minter for new tokens when it hears about
///     deposits into the L1 token bridge. It also acts as a burner of the tokens
///     intended for withdrawal, informing the L1 bridge to release L1 funds. Additionally, adds
///     the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2ERC20ExtendedTokensBridge is
    IL2ERC20Bridge,
    BridgingManager,
    RebasableAndNonRebasableTokens,
    CrossDomainEnabled,
    Versioned
{
    using SafeERC20 for IERC20;

    address private immutable L1_TOKEN_BRIDGE;

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
    ) CrossDomainEnabled(messenger_) RebasableAndNonRebasableTokens (
        l1TokenNonRebasable_,
        l1TokenRebasable_,
        l2TokenNonRebasable_,
        l2TokenRebasable_
    ) {
        if (l1TokenBridge_ == address(0)) {
            revert ErrorZeroAddressL1Bridge();
        }
        L1_TOKEN_BRIDGE = l1TokenBridge_;
    }

    /// @notice Initializes the contract from scratch.
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function initialize(address admin_) external {
        _initializeExtendedTokensBridge();
        _initializeBridgingManager(admin_);
    }

    /// @notice A function to finalize upgrade to v2 (from v1).
    function finalizeUpgrade_v2() external {
        if (!_isBridgingManagerInitialized()) {
            revert ErrorBridgingManagerIsNotInitialized();
        }
        _initializeExtendedTokensBridge();
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
    ) external
        whenWithdrawalsEnabled
        onlySupportedL2Token(l2Token_)
    {
        if (Address.isContract(msg.sender)) {
            revert ErrorSenderNotEOA();
        }
        _withdrawTo(l2Token_, msg.sender, msg.sender, amount_, l1Gas_, data_);
        emit WithdrawalInitiated(_getL1Token(l2Token_), l2Token_, msg.sender, msg.sender, amount_, data_);
    }

    /// @inheritdoc IL2ERC20Bridge
    function withdrawTo(
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) external
        whenWithdrawalsEnabled
        onlyNonZeroAccount(to_)
        onlySupportedL2Token(l2Token_)
    {
        _withdrawTo(l2Token_, msg.sender, to_, amount_, l1Gas_, data_);
        emit WithdrawalInitiated(_getL1Token(l2Token_), l2Token_, msg.sender, to_, amount_, data_);
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
        onlyFromCrossDomainAccount(L1_TOKEN_BRIDGE)
        onlySupportedL1L2TokensPair(l1Token_, l2Token_)
    {
        DepositDataCodec.DepositData memory depositData = DepositDataCodec.decodeDepositData(data_);
        ITokenRateUpdatable tokenRateOracle = ERC20RebasableBridged(L2_TOKEN_REBASABLE).TOKEN_RATE_ORACLE();
        tokenRateOracle.updateRate(depositData.rate, depositData.timestamp);

        uint256 depositedL2TokenAmount = _mintTokens(l2Token_, to_, amount_);
        emit DepositFinalized(l1Token_, l2Token_, from_, to_, depositedL2TokenAmount, depositData.data);
    }

    function _initializeExtendedTokensBridge() internal {
        _initializeContractVersionTo(2);
        // used for `bridgeWrap` call to succeed in the `_mintTokens` method
        IERC20(L2_TOKEN_NON_REBASABLE).safeIncreaseAllowance(L2_TOKEN_REBASABLE, type(uint256).max);
    }

    /// @notice Performs the logic for withdrawals by burning the token and informing
    ///         the L1 token Gateway of the withdrawal. This function does not allow sending to token addresses.
    ///         L1_TOKEN_REBASABLE does not allow transfers to itself. Additionally, sending funds to
    ///         L1_TOKEN_NON_REBASABLE would lock these funds permanently, as it is non-upgradeable.
    /// @param l2Token_ Address of L2 token where withdrawal was initiated.
    /// @param from_ Account to pull the withdrawal from on L2
    /// @param to_ Account to give the withdrawal to on L1.
    /// @param amount_ Amount of the token to withdraw
    /// @param l1Gas_ Minimum gas limit to use for the transaction.
    /// @param data_ Optional data to forward to L1. This data is provided
    ///        solely as a convenience for external contracts. Aside from enforcing a maximum
    ///        length, these contracts provide no guarantees about its content
    function _withdrawTo(
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    ) internal {
        if (to_ == L1_TOKEN_REBASABLE || to_ == L1_TOKEN_NON_REBASABLE) {
            revert ErrorTransferToL1TokenContract();
        }

        uint256 nonRebasableAmountToWithdraw = _burnTokens(l2Token_, from_, amount_);

        bytes memory message = abi.encodeWithSelector(
            IL1ERC20Bridge.finalizeERC20Withdrawal.selector,
            _getL1Token(l2Token_), l2Token_, from_, to_, nonRebasableAmountToWithdraw, data_
        );
        sendCrossDomainMessage(L1_TOKEN_BRIDGE, l1Gas_, message);
    }

    /// @notice Mints tokens, wraps if needed and returns amount of minted tokens.
    /// @param l2Token_ Address of L2 token for which deposit is finalizing.
    /// @param to_ Account that token mints for.
    /// @param nonRebasableTokenAmount_ Amount of non-rebasable token.
    /// @return returns amount of minted tokens.
    function _mintTokens(
        address l2Token_,
        address to_,
        uint256 nonRebasableTokenAmount_
    ) internal returns (uint256) {
        if (nonRebasableTokenAmount_ == 0) {
            return 0;
        }
        if (l2Token_ == L2_TOKEN_REBASABLE) {
            IERC20Bridged(L2_TOKEN_NON_REBASABLE).bridgeMint(address(this), nonRebasableTokenAmount_);
            return ERC20RebasableBridged(l2Token_).bridgeWrap(to_, nonRebasableTokenAmount_);
        }
        IERC20Bridged(l2Token_).bridgeMint(to_, nonRebasableTokenAmount_);
        return nonRebasableTokenAmount_;
    }

    /// @notice Unwraps if needed, burns tokens and returns amount of non-rebasable token to withdraw.
    /// @param l2Token_ Address of L2 token where withdrawal was initiated.
    /// @param from_ Account which tokens are burns.
    /// @param amount_ Amount of token to burn.
    /// @return returns amount of non-rebasable token to withdraw.
    function _burnTokens(
        address l2Token_,
        address from_,
        uint256 amount_
    ) internal returns (uint256) {
        if (amount_ == 0) {
            return 0;
        }
        uint256 nonRebasableTokenAmount = amount_;
        if (l2Token_ == L2_TOKEN_REBASABLE) {
            nonRebasableTokenAmount = ERC20RebasableBridged(L2_TOKEN_REBASABLE).getSharesByTokens(amount_);
            if (nonRebasableTokenAmount != 0) {
                ERC20RebasableBridged(L2_TOKEN_REBASABLE).bridgeUnwrap(from_, amount_);
                IERC20Bridged(L2_TOKEN_NON_REBASABLE).bridgeBurn(from_, nonRebasableTokenAmount);
            }
            return nonRebasableTokenAmount;
        }
        IERC20Bridged(L2_TOKEN_NON_REBASABLE).bridgeBurn(from_, nonRebasableTokenAmount);
        return nonRebasableTokenAmount;
    }

    error ErrorSenderNotEOA();
    error ErrorZeroAddressL1Bridge();
    error ErrorTransferToL1TokenContract();
}
