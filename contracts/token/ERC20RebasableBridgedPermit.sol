// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20RebasableBridged} from "./ERC20RebasableBridged.sol";
import {PermitExtension} from "./PermitExtension.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author kovalgek
/// @notice extends ERC20RebasableBridged functionality that allows to use permits and versioning.
contract ERC20RebasableBridgedPermit is ERC20RebasableBridged, PermitExtension, Versioned {

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The current major version of the signing domain (aka token version)
    /// @param decimals_ The decimals places of the token
    /// @param tokenToWrapFrom_ address of the ERC20 token to wrap
    /// @param tokenRateOracle_ address of oracle that returns tokens rate
    /// @param bridge_ The bridge address which allowd to mint/burn tokens
    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        uint8 decimals_,
        address tokenToWrapFrom_,
        address tokenRateOracle_,
        address bridge_
    )
        ERC20RebasableBridged(
            name_,
            symbol_,
            decimals_,
            tokenToWrapFrom_,
            tokenRateOracle_,
            bridge_
        )
        PermitExtension(name_, version_)
    {
    }

    /// @notice Initializes the contract from scratch.
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The version of the token
    function initialize(string memory name_, string memory symbol_, string memory version_) external {
        _initializeContractVersionTo(1);
        _initializeERC20Metadata(name_, symbol_);
        _initializeEIP5267Metadata(name_, version_);
    }

    /// @inheritdoc PermitExtension
    function _permitAccepted(address owner_, address spender_, uint256 amount_) internal override {
        _approve(owner_, spender_, amount_);
    }
}
