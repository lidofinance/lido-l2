// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Ownable} from "../token/interfaces/IERC20Ownable.sol";

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

contract L2TokenBridge is
    IL2ERC20Bridge,
    BridgingManager,
    BridgeableTokens,
    CrossDomainEnabled
{
    address public immutable l1TokenBridge;

    constructor(
        address messenger_,
        address l1TokenBridge_,
        address l1Token_,
        address l2Token_
    ) CrossDomainEnabled(messenger_) BridgeableTokens(l1Token_, l2Token_) {
        l1TokenBridge = l1TokenBridge_;
    }

    function withdraw(
        address _l2Token,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    )
        external
        virtual
        override
        whenWithdrawalsEnabled
        onlySupportedL2Token(_l2Token)
    {
        _initiateWithdrawal(msg.sender, msg.sender, _amount, _l1Gas, _data);
    }

    function withdrawTo(
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    )
        external
        virtual
        override
        whenWithdrawalsEnabled
        onlySupportedL2Token(_l2Token)
    {
        _initiateWithdrawal(msg.sender, _to, _amount, _l1Gas, _data);
    }

    function _initiateWithdrawal(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) internal {
        IERC20Ownable(l2Token).burn(msg.sender, _amount);

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

    function finalizeDeposit(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    )
        external
        virtual
        override
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
        onlySupportedL2Token(_l2Token)
        onlyFromCrossDomainAccount(l1TokenBridge)
    {
        IERC20Ownable(l2Token).mint(_to, _amount);
        emit DepositFinalized(_l1Token, _l2Token, _from, _to, _amount, _data);
    }
}
