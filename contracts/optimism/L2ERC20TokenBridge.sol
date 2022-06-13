// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";
import {IERC20Ownable} from "../token/interfaces/IERC20Ownable.sol";

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

/// @author psirex
/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. It acts as a minter for new tokens when it hears about
///     deposits into the L1 token bridge. It also acts as a burner of the tokens
///     intended for withdrawal, informing the L1 bridge to release L1 funds.
contract L2ERC20TokenBridge is
    IL2ERC20Bridge,
    BridgingManager,
    BridgeableTokens,
    CrossDomainEnabled
{
    /// @notice Address of the corresponding L1 bridge contract
    address public immutable l1TokenBridge;

    /// @param messenger_ L2 messenger address being used for cross-chain communications
    /// @param l1TokenBridge_  Address of the corresponding L1 bridge
    /// @param l1Token_ Address of the bridged token in the L1 chain
    /// @param l2Token_ Address of the token minted on the L2 chain when token bridged
    constructor(
        address messenger_,
        address l1TokenBridge_,
        address l1Token_,
        address l2Token_
    ) CrossDomainEnabled(messenger_) BridgeableTokens(l1Token_, l2Token_) {
        l1TokenBridge = l1TokenBridge_;
    }

    /// @notice Initiates a withdraw of some tokens to the caller's account on L1
    /// @param l2Token_ Address of L2 token where withdrawal was initiated.
    /// @param amount_ Amount of the token to withdraw.
    ///     param _l1Gas Unused, but included for potential forward compatibility considerations.
    /// @param data_ Optional data to forward to L1. This data is provided
    ///     solely as a convenience for external contracts. Aside from enforcing a maximum
    ///     length, these contracts provide no guarantees about its content.
    function withdraw(
        address l2Token_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    )
        external
        virtual
        override
        whenWithdrawalsEnabled
        onlySupportedL2Token(l2Token_)
    {
        _initiateWithdrawal(msg.sender, msg.sender, amount_, l1Gas_, data_);
    }

    /// @notice Initiates a withdraw of some token to a recipient's account on L1.
    /// @param l2Token_ Address of L2 token where withdrawal is initiated.
    /// @param to_ L1 adress to credit the withdrawal to.
    /// @param amount_ Amount of the token to withdraw.
    ///     param _l1Gas Unused, but included for potential forward compatibility considerations.
    /// @param data_ Optional data to forward to L1. This data is provided
    ///     solely as a convenience for external contracts. Aside from enforcing a maximum
    ///     length, these contracts provide no guarantees about its content.
    function withdrawTo(
        address l2Token_,
        address to_,
        uint256 amount_,
        uint32 l1Gas_,
        bytes calldata data_
    )
        external
        virtual
        override
        whenWithdrawalsEnabled
        onlySupportedL2Token(l2Token_)
    {
        _initiateWithdrawal(msg.sender, to_, amount_, l1Gas_, data_);
    }

    function _initiateWithdrawal(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) internal {
        IERC20Ownable(l2Token).burn(_from, _amount);

        bytes memory message = abi.encodeWithSelector(
            IL1ERC20Bridge.finalizeERC20Withdrawal.selector,
            l1Token,
            l2Token,
            _from,
            _to,
            _amount,
            _data
        );

        sendCrossDomainMessage(l1TokenBridge, _l1Gas, message);

        emit WithdrawalInitiated(
            l1Token,
            l2Token,
            msg.sender,
            _to,
            _amount,
            _data
        );
    }

    /// @notice Completes a deposit from L1 to L2, and credits funds to the recipient's balance of
    ///     this L2 token. This call will fail if it did not originate from a corresponding deposit
    ///     in L1StandardTokenBridge.
    /// @param l1Token_ Address for the l1 token this is called with
    /// @param l2Token_ Address for the l2 token this is called with
    /// @param from_ Account to pull the deposit from on L2.
    /// @param to_ Address to receive the withdrawal at
    /// @param amount_ Amount of the token to withdraw
    /// @param data_ Data provider by the sender on L1. This data is provided
    ///     solely as a convenience for external contracts. Aside from enforcing a maximum
    ///     length, these contracts provide no guarantees about its content.
    function finalizeDeposit(
        address l1Token_,
        address l2Token_,
        address from_,
        address to_,
        uint256 amount_,
        bytes calldata data_
    )
        external
        virtual
        override
        whenDepositsEnabled
        onlySupportedL1Token(l1Token_)
        onlySupportedL2Token(l2Token_)
        onlyFromCrossDomainAccount(l1TokenBridge)
    {
        IERC20Ownable(l2Token).mint(to_, amount_);
        emit DepositFinalized(l1Token_, l2Token_, from_, to_, amount_, data_);
    }
}
