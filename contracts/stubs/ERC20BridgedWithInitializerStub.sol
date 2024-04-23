// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20Bridged} from "../token/ERC20Bridged.sol";

/// @dev For testing purposes.
contract ERC20BridgedWithInitializerStub is ERC20Bridged {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address bridge_
    ) ERC20Bridged(name_, symbol_, decimals_, bridge_) {}

    function initializeERC20Metadata(string memory name_, string memory symbol_) external {
        _initializeERC20Metadata(name_, symbol_);
    }
}
