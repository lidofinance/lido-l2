// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20Bridged} from "./ERC20Bridged.sol";
import {PermitExtension} from "./PermitExtension.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author kovalgek
contract ERC20BridgedPermit is ERC20Bridged, PermitExtension, Versioned {

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The current major version of the signing domain (aka token version)
    /// @param decimals_ The decimals places of the token
    /// @param bridge_ The bridge address which allowd to mint/burn tokens
    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        uint8 decimals_,
        address bridge_
    )
        ERC20Bridged(name_, symbol_, decimals_, bridge_)
        PermitExtension(name_, version_)
    {
    }

    /// @notice Initializes the contract from scratch.
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The version of the token
    function initialize(string memory name_, string memory symbol_, string memory version_) external {
        _initialize_v2(name_, symbol_, version_);
    }

    /// @notice A function to finalize upgrade to v2 (from v1).
    function finalizeUpgrade_v2(string memory name_, string memory version_) external {
        // name and symbol from ERCMetadata already set up in storage, then it is defenetly was v1
        if (bytes(name()).length > 0 && bytes(symbol()).length > 0) {
            _updateContractVersion(2);
            _initializeEIP5267Metadata(name_, version_);
        } else {
            // metadata is epmty, incorrect function to call
            // error?
        }
    }

    function _initialize_v2(string memory name_, string memory symbol_, string memory version_) internal {
        _updateContractVersion(2);
        _initializeERC20Metadata(name_, symbol_);
        _initializeEIP5267Metadata(name_, version_);
    }

    /// @inheritdoc PermitExtension
    function _permitAccepted(address owner_, address spender_, uint256 amount_) internal override {
        _approve(owner_, spender_, amount_);
    }
}
