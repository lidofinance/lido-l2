// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRatePusher} from "../interfaces/ITokenRatePusher.sol";

contract TokenRatePusherStub is ITokenRatePusher {

    uint32 public l2Gas;

    function pushTokenRate(uint32 l2Gas_) external {
        l2Gas = l2Gas_;
    }
}
