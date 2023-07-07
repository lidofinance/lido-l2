// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import {IL2ERC20Bridge} from "../interfaces/IL2ERC20Bridge.sol";

contract L1ERC20BridgeStub {
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte,
        address _refundRecipient,
        address _l2Bridge,
        bytes memory data
    ) public payable returns (bool) {
        IL2ERC20Bridge(_l2Bridge).finalizeDeposit{value: msg.value}(
            msg.sender,
            _l2Receiver,
            _l1Token,
            _amount,
            data
        );
    }
}
