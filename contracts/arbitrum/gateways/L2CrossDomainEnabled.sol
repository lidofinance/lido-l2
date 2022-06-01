// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IArbSys} from "../interfaces/IArbSys.sol";

contract L2CrossDomainEnabled {
    IArbSys public immutable arbSys;

    constructor(address arbSys_) {
        arbSys = IArbSys(arbSys_);
    }

    function sendCrossDomainMessage(address recipient, bytes memory data)
        internal
        returns (uint256)
    {
        return IArbSys(arbSys).sendTxToL1(recipient, data);
    }

    modifier onlyFromCrossDomainAccount(address account) {
        uint160 offset = uint160(0x1111000000000000000000000000000000001111);
        address aliasedAccount = address(uint160(account) + offset);
        if (msg.sender != aliasedAccount) {
            revert ErrorWrongCrossDomainSender();
        }
        _;
    }

    error ErrorWrongCrossDomainSender();
}
