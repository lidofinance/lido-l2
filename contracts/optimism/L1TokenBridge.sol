// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";

import {BridgingManager} from "../BridgingManager.sol";
import {BridgeableTokens} from "../BridgeableTokens.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";

contract L1TokenBridge is
    IL1ERC20Bridge,
    BridgingManager,
    BridgeableTokens,
    CrossDomainEnabled
{
    using SafeERC20 for IERC20;

    address public immutable l2TokenBridge;

    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1Token_,
        address l2Token_
    ) CrossDomainEnabled(messenger_) BridgeableTokens(l1Token_, l2Token_) {
        l2TokenBridge = l2TokenBridge_;
    }

    function depositERC20(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    )
        external
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
        onlySupportedL2Token(_l2Token)
    {
        if (Address.isContract(msg.sender)) {
            revert ErrorSenderNotEOA();
        }
        _initiateERC20Deposit(msg.sender, msg.sender, _amount, _l2Gas, _data);
    }

    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    )
        external
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
        onlySupportedL2Token(_l2Token)
    {
        _initiateERC20Deposit(msg.sender, _to, _amount, _l2Gas, _data);
    }

    function _initiateERC20Deposit(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) internal {
        IERC20(l1Token).safeTransferFrom(_from, address(this), _amount);

        bytes memory message = abi.encodeWithSelector(
            IL2ERC20Bridge.finalizeDeposit.selector,
            l1Token,
            l2Token,
            _from,
            _to,
            _amount,
            _data
        );

        sendCrossDomainMessage(l2TokenBridge, _l2Gas, message);

        emit ERC20DepositInitiated(
            l1Token,
            l2Token,
            _from,
            _to,
            _amount,
            _data
        );
    }

    function finalizeERC20Withdrawal(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    )
        external
        whenWithdrawalsEnabled
        onlySupportedL1Token(_l1Token)
        onlySupportedL2Token(_l2Token)
        onlyFromCrossDomainAccount(l2TokenBridge)
    {
        IERC20(l1Token).safeTransfer(_to, _amount);

        emit ERC20WithdrawalFinalized(
            l1Token,
            l2Token,
            _from,
            _to,
            _amount,
            _data
        );
    }

    error ErrorSenderNotEOA();
}
