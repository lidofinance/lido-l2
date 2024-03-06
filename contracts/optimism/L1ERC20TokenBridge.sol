// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
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
import {DepositDataCodec} from "./DepositDataCodec.sol";
import {IERC20WstETH} from "../token/interfaces/IERC20WstETH.sol";

/// @author psirex, kovalgek
/// @notice The L1 ERC20 token bridge locks bridged tokens on the L1 side, sends deposit messages
///     on the L2 side, and finalizes token withdrawals from L2. Additionally, adds the methods for
///     bridging management: enabling and disabling withdrawals/deposits
abstract contract L1ERC20TokenBridge is
    IL1ERC20Bridge,
    BridgingManager,
    RebasableAndNonRebasableTokens,
    CrossDomainEnabled,
    DepositDataCodec
{
    using SafeERC20 for IERC20;

    address public immutable L2_TOKEN_BRIDGE;

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
    ) CrossDomainEnabled(messenger_) RebasableAndNonRebasableTokens(l1TokenNonRebasable_, l1TokenRebasable_, l2TokenNonRebasable_, l2TokenRebasable_) {
        L2_TOKEN_BRIDGE = l2TokenBridge_;
    }

    function tokenRate() virtual internal view returns (uint256);

    /// @notice Pushes token rate to L2 by depositing zero tokens.
    /// @param l2Gas_ Gas limit required to complete the deposit on L2.
    function pushTokenRate(uint32 l2Gas_) external {
        _depositERC20To(L1_TOKEN_REBASABLE, L2_TOKEN_REBASABLE, L2_TOKEN_BRIDGE, 0, l2Gas_, "");
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
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
    {
        if (Address.isContract(msg.sender)) {
            revert ErrorSenderNotEOA();
        }

        _depositERC20To(l1Token_, l2Token_, msg.sender, amount_, l2Gas_, data_);
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
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
    {
        _depositERC20To(l1Token_, l2Token_, to_, amount_, l2Gas_, data_);
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
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
        onlyFromCrossDomainAccount(L2_TOKEN_BRIDGE)
    {
        if (isRebasableTokenFlow(l1Token_, l2Token_)) {
            uint256 rebasableTokenAmount = IERC20Wrapper(L1_TOKEN_NON_REBASABLE).unwrap(amount_);
            IERC20(L1_TOKEN_REBASABLE).safeTransfer(to_, rebasableTokenAmount);

            emit ERC20WithdrawalFinalized(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                from_,
                to_,
                rebasableTokenAmount,
                data_
            );
        } else if (isNonRebasableTokenFlow(l1Token_, l2Token_)) {
            IERC20(L1_TOKEN_NON_REBASABLE).safeTransfer(to_, amount_);

            emit ERC20WithdrawalFinalized(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                from_,
                to_,
                amount_,
                data_
            );
        }
    }

    function _depositERC20To(
        address l1Token_,
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes memory data_
    ) internal {
        if (isRebasableTokenFlow(l1Token_, l2Token_)) {
            DepositData memory depositData = DepositData({
                rate: uint96(tokenRate()),
                timestamp: uint40(block.timestamp),
                data: data_
            });
            bytes memory encodedDepositData = encodeDepositData(depositData);

            if (amount_ == 0) {
                _initiateERC20Deposit(
                    L1_TOKEN_REBASABLE,
                    L2_TOKEN_REBASABLE,
                    msg.sender,
                    to_,
                    0,
                    l2Gas_,
                    encodedDepositData
                );

                emit ERC20DepositInitiated(
                    L1_TOKEN_REBASABLE,
                    L2_TOKEN_REBASABLE,
                    msg.sender,
                    to_,
                    0,
                    encodedDepositData
                );

                return;
            }

            IERC20(L1_TOKEN_REBASABLE).safeTransferFrom(msg.sender, address(this), amount_);
            if(!IERC20(L1_TOKEN_REBASABLE).approve(L1_TOKEN_NON_REBASABLE, amount_)) {
                revert ErrorRebasableTokenApprove();
            }
            uint256 nonRebasableTokenAmount = IERC20Wrapper(L1_TOKEN_NON_REBASABLE).wrap(amount_);

            _initiateERC20Deposit(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                msg.sender,
                to_,
                nonRebasableTokenAmount,
                l2Gas_,
                encodedDepositData
            );

            emit ERC20DepositInitiated(
                L1_TOKEN_REBASABLE,
                L2_TOKEN_REBASABLE,
                msg.sender,
                to_,
                amount_,
                encodedDepositData
            );
        } else if (isNonRebasableTokenFlow(l1Token_, l2Token_)) {
            IERC20(L1_TOKEN_NON_REBASABLE).safeTransferFrom(msg.sender, address(this), amount_);

            _initiateERC20Deposit(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                msg.sender,
                to_,
                amount_,
                l2Gas_,
                data_
            );

            emit ERC20DepositInitiated(
                L1_TOKEN_NON_REBASABLE,
                L2_TOKEN_NON_REBASABLE,
                msg.sender,
                to_,
                amount_,
                data_
            );
        }
    }

    /// @dev Performs the logic for deposits by informing the L2 token bridge contract
    ///     of the deposit and calling safeTransferFrom to lock the L1 funds.
    /// @param from_ Account to pull the deposit from on L1
    /// @param to_ Account to give the deposit to on L2
    /// @param amount_ Amount of the ERC20 to deposit.
    /// @param l2Gas_ Gas limit required to complete the deposit on L2.
    /// @param data_ Optional data to forward to L2. This data is provided
    ///        solely as a convenience for external contracts. Aside from enforcing a maximum
    ///        length, these contracts provide no guarantees about its content.
    function _initiateERC20Deposit(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes memory data_
    ) internal {
        bytes memory message = abi.encodeWithSelector(
            IL2ERC20Bridge.finalizeDeposit.selector,
            l1Token_,
            l2Token_,
            from_,
            to_,
            amount_,
            data_
        );

        sendCrossDomainMessage(L2_TOKEN_BRIDGE, l2Gas_, message);
    }

    error ErrorSenderNotEOA();
    error ErrorRebasableTokenApprove();
}
