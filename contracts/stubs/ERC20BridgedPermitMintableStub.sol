// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20BridgedPermit} from "../token/ERC20BridgedPermit.sol";

/// @dev For testing purposes.
///
///     `ERC20BridgedPermit` carries no mint/burn authority of its own after
///     patches/lido-l2-with-steth/0001. This stub restores an unrestricted mint/burn so the
///     ERC20 core, metadata, permit and versioning suites still have a way to create supply.
///     It stands in for the CCIP BurnMint token that will hold MINTER_ROLE/BURNER_ROLE in
///     production: same inherited surface, without the AccessControl gate.
contract ERC20BridgedPermitMintableStub is ERC20BridgedPermit {
    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        uint8 decimals_
    ) ERC20BridgedPermit(name_, symbol_, version_, decimals_) {}

    function mint(address account_, uint256 amount_) external {
        _mint(account_, amount_);
    }

    function burn(address account_, uint256 amount_) external {
        _burn(account_, amount_);
    }
}
