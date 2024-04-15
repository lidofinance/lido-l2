// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20Rebasable} from "./ERC20Rebasable.sol";
import {PermitExtension} from "./PermitExtension.sol";

/// @author kovalgek
contract ERC20RebasablePermit is ERC20Rebasable, PermitExtension {

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The current major version of the signing domain (aka token version)
    /// @param decimals_ The decimals places of the token
    /// @param wrappedToken_ address of the ERC20 token to wrap
    /// @param tokenRateOracle_ address of oracle that returns tokens rate
    /// @param bridge_ The bridge address which allowd to mint/burn tokens
    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        uint8 decimals_,
        address wrappedToken_,
        address tokenRateOracle_,
        address bridge_
    )
        ERC20Rebasable(name_, symbol_, decimals_, wrappedToken_, tokenRateOracle_, bridge_)
        PermitExtension(name_, version_)
    {
    }

    function _permitAccepted(
        address owner_,
        address spender_,
        uint256 amount_
    ) internal override {
        _approve(owner_, spender_, amount_);
    }
}
