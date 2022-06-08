// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

/// @author psirex
/// @notice The L1 ERC20 token bridge locks bridged tokens on the L1 side, sends deposit messages
///     on the L2 side, and finalizes token withdrawals from L2.
contract L1ERC20TokenBridge is
    IL1ERC20Bridge,
    BridgingManager,
    BridgeableTokens,
    CrossDomainEnabled
{
    using SafeERC20 for IERC20;

    /// @notice Address of the corresponding L2 bridge contract
    address public immutable l2TokenBridge;

    /// @param messenger_ L1 messenger address being used for cross-chain communications
    /// @param l2TokenBridge_  Address of the corresponding L2 bridge
    /// @param l1Token_ Address of the bridged token in the L1 chain
    /// @param l2Token_ Address of the token minted on the L2 chain when token bridged
    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1Token_,
        address l2Token_
    ) CrossDomainEnabled(messenger_) BridgeableTokens(l1Token_, l2Token_) {
        l2TokenBridge = l2TokenBridge_;
    }

    /// @notice Deposits an amount of the ERC20 to the caller's balance on L2
    /// @param l1Token_ Address of the L1 ERC20 to be deposited
    /// @param l2Token_ Address of the L1 respective L2 ERC20
    /// @param amount_ Amount of the ERC20 to deposit
    /// @param l2Gas_ Gas limit required to complete the deposit on L2
    /// @param data_ Optional data to forward to L2. This data is provided solely as a
    ///     convenience for external contracts. Aside from enforcing a maximum length, these
    ///     contracts provide no guarantees about its content
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
        _initiateERC20Deposit(msg.sender, msg.sender, amount_, l2Gas_, data_);
    }

    /// @notice Deposits an amount of ERC20 to a recipient's balance on L2
    /// @param l1Token_ Address of the L1 ERC20 to be deposited
    /// @param l2Token_ Address of the L1 respective L2 ERC20
    /// @param to_ Account to give the deposit to on L2
    /// @param amount_ Amount of the ERC20 to deposit.
    /// @param l2Gas_ Gas limit required to complete the deposit on L2.
    /// @param data_ Optional data to forward to L2. This data is provided solely as a
    ///     convenience for external contracts. Aside from enforcing a maximum length, these
    /// contracts provide no guarantees about its content.
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
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
    {
        _initiateERC20Deposit(msg.sender, to_, amount_, l2Gas_, data_);
    }

    /// @notice Completes a withdrawal from L2 to L1, and credit funds to the recipient’s balance
    ///     of the L1 ERC20 token.
    /// @dev This call will fail if the initialized withdrawal from L2 has not been finalized.
    /// @param l1Token_ Address of L1 token to finalizeWithdrawal for
    /// @param l2Token_ Address of L2 token where withdrawal was initiated.
    /// @param from_ L2 address initiating the transfer
    /// @param to_ L1 address to credit the withdrawal to
    /// @param amount_ Amount of the ERC20 to deposit
    /// @param data_ Data provided by the sender on L2. This data is provided solely as a
    ///     convenience for external contracts. Aside from enforcing a maximum length, these
    ///     contracts provide no guarantees about its content.
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
        onlyFromCrossDomainAccount(l2TokenBridge)
    {
        IERC20(l1Token).safeTransfer(to_, amount_);

        emit ERC20WithdrawalFinalized(
            l1Token,
            l2Token,
            from_,
            to_,
            amount_,
            data_
        );
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
        address from_,
        address to_,
        uint256 amount_,
        uint32 l2Gas_,
        bytes calldata data_
    ) internal {
        IERC20(l1Token).safeTransferFrom(from_, address(this), amount_);

        bytes memory message = abi.encodeWithSelector(
            IL2ERC20Bridge.finalizeDeposit.selector,
            l1Token,
            l2Token,
            from_,
            to_,
            amount_,
            data_
        );

        sendCrossDomainMessage(l2TokenBridge, l2Gas_, message);

        emit ERC20DepositInitiated(
            l1Token,
            l2Token,
            from_,
            to_,
            amount_,
            data_
        );
    }

    error ErrorSenderNotEOA();
}
