// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

interface IL2ERC20Bridge {
    function initialize(
        address l1TokenBridge_,
        address l1Token_,
        address l2Token_
    ) external;
}
