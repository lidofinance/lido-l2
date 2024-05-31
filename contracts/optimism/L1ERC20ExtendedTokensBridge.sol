// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";
import {IERC20Wrapper} from "../token/interfaces/IERC20Wrapper.sol";
import {BridgingManager} from "../BridgingManager.sol";
import {RebasableAndNonRebasableTokens} from "./RebasableAndNonRebasableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {DepositDataCodec} from "../lib//DepositDataCodec.sol";

/// @author psirex, kovalgek
/// @notice The L1 ERC20 token bridge locks bridged tokens on the L1 side, sends deposit messages
///     on the L2 side, and finalizes token withdrawals from L2. Additionally, adds the methods for
///     bridging management: enabling and disabling withdrawals/deposits
abstract contract L1ERC20ExtendedTokensBridge is
    IL1ERC20Bridge,
    BridgingManager,
    RebasableAndNonRebasableTokens,
    CrossDomainEnabled
{
    using SafeERC20 for IERC20;

    address private immutable L2_TOKEN_BRIDGE;

    /// @param messenger_ L1 messenger address being used for cross-chain communications
    /// @param l2TokenBridge_ Address of the corresponding L2 bridge
    /// @param l1TokenNonRebasable_ Address of the bridged token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the token minted on the L2 chain when token bridged
    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) CrossDomainEnabled(messenger_) RebasableAndNonRebasableTokens(
        l1TokenNonRebasable_,
        l1TokenRebasable_,
        l2TokenNonRebasable_,
        l2TokenRebasable_
    ) {
        if (l2TokenBridge_ == address(0)) {
            revert ErrorZeroAddressL2Bridge();
        }
        L2_TOKEN_BRIDGE = l2TokenBridge_;
    }

    /// @inheritdoc IL1ERC20Bridge
    function l2TokenBridge() external view returns (address) {
        return L2_TOKEN_BRIDGE;
    }

    /// @inheritdoc IL1ERC20Bridge
    function depositERC20(
        address l1Token_,
        address l2Token_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes calldata data_
    )
        external
        whenDepositsEnabled
        onlySupportedL1L2TokensPair(l1Token_, l2Token_)
    {
        if (Address.isContract(msg.sender)) {
            revert ErrorSenderNotEOA();
        }
        bytes memory encodedDepositData  = _encodeInputDepositData(data_);
        _depositERC20To(l1Token_, l2Token_, msg.sender, msg.sender, amount_, l2Gas_, encodedDepositData);
        emit ERC20DepositInitiated(l1Token_, l2Token_, msg.sender, msg.sender, amount_, encodedDepositData);
    }

    /// @inheritdoc IL1ERC20Bridge
    function depositERC20To(
        address l1Token_,
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes calldata data_
    )
        external
        whenDepositsEnabled
        onlyNonZeroAccount(to_)
        onlySupportedL1L2TokensPair(l1Token_, l2Token_)
    {
        bytes memory encodedDepositData  = _encodeInputDepositData(data_);
        _depositERC20To(l1Token_, l2Token_, msg.sender, to_, amount_, l2Gas_, encodedDepositData);
        emit ERC20DepositInitiated(l1Token_, l2Token_, msg.sender, to_, amount_, encodedDepositData);
    }

    /// @inheritdoc IL1ERC20Bridge
    function finalizeERC20Withdrawal(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes calldata data_
    )
        external
        whenWithdrawalsEnabled
        onlyFromCrossDomainAccount(L2_TOKEN_BRIDGE)
        onlySupportedL1L2TokensPair(l1Token_, l2Token_)
    {
        uint256 withdrawnL1TokenAmount = (l1Token_ == L1_TOKEN_REBASABLE && amount_ != 0) ?
            IERC20Wrapper(L1_TOKEN_NON_REBASABLE).unwrap(amount_) :
            amount_;
        IERC20(l1Token_).safeTransfer(to_, withdrawnL1TokenAmount);
        emit ERC20WithdrawalFinalized(l1Token_, l2Token_, from_, to_, withdrawnL1TokenAmount, data_);
    }

    /// @notice Performs the logic for deposits by informing the L2 token bridge contract
    ///     of the deposit and calling safeTransferFrom to lock the L1 funds.
    /// @param l1Token_ Address of the L1 ERC20 we are depositing
    /// @param l2Token_ Address of the L1 respective L2 ERC20
    /// @param from_ Account to pull the deposit from on L1
    /// @param to_ Account to give the deposit to on L2
    /// @param amount_ Amount of the ERC20 to deposit.
    /// @param l2Gas_ Gas limit required to complete the deposit on L2.
    /// @param encodedDepositData_ a concatenation of packed token rate with L1 time and
    ///        optional data passed by external contract
    function _depositERC20To(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes memory encodedDepositData_
    ) internal {
        uint256 nonRebasableAmountToDeposit = _transferToBridge(l1Token_, from_, amount_);

        bytes memory message = abi.encodeWithSelector(
            IL2ERC20Bridge.finalizeDeposit.selector,
            l1Token_, l2Token_, from_, to_, nonRebasableAmountToDeposit, encodedDepositData_
        );

        sendCrossDomainMessage(L2_TOKEN_BRIDGE, l2Gas_, message);
    }

    /// @notice Transfers tokens to the bridge and wraps if needed.
    /// @param l1Token_ Address of the L1 ERC20 we are depositing.
    /// @param from_ Account to pull the deposit from on L1.
    /// @param amount_ Amount of the ERC20 to deposit.
    /// @return Amount of non-rebasable token.
    function _transferToBridge(
        address l1Token_,
        address from_,
        uint256 amount_
    ) internal returns (uint256) {
        if (amount_ != 0) {
            IERC20(l1Token_).safeTransferFrom(from_, address(this), amount_);
            if (l1Token_ == L1_TOKEN_REBASABLE) {
                IERC20(l1Token_).safeIncreaseAllowance(L1_TOKEN_NON_REBASABLE, amount_);
                return IERC20Wrapper(L1_TOKEN_NON_REBASABLE).wrap(amount_);
            }
        }
        return amount_;
    }

    /// @dev Helper that simplifies calling encoding by DepositDataCodec.
    ///      Encodes token rate, it's L1 timestamp and optional data.
    /// @param data_ Optional data to forward to L2.
    /// @return encoded data in the 'wired' bytes form.
    function _encodeInputDepositData(bytes calldata data_) internal view returns (bytes memory)  {
        (uint256 rate, uint256 timestamp) = _tokenRate();
        return DepositDataCodec.encodeDepositData(DepositDataCodec.DepositData({
            rate: uint128(rate),
            timestamp: uint40(timestamp),
            data: data_
        }));
    }

    /// @notice required to abstact a way token rate is requested.
    function _tokenRate() virtual internal view returns (uint256 rate_, uint256 updateTimestamp_);

    error ErrorSenderNotEOA();
    error ErrorZeroAddressL2Bridge();
}
