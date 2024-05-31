// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20Bridged} from "./ERC20Bridged.sol";
import {PermitExtension} from "./PermitExtension.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @author kovalgek
/// @notice extends ERC20Bridged functionality that allows to use permits and versioning.
contract ERC20BridgedPermit is ERC20Bridged, PermitExtension, Versioned {

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param version_ The current major version of the signing domain (aka token version)
    /// @param decimals_ The decimals places of the token
    /// @param bridge_ The bridge address which allows to mint/burn tokens
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
        if (_isMetadataInitialized()) {
            revert ErrorMetadataIsAlreadyInitialized();
        }
        _initializeERC20Metadata(name_, symbol_);
        _initialize_v2(name_, version_);
    }

    /// @notice A function to finalize upgrade to v2 (from v1).
    function finalizeUpgrade_v2(string memory name_, string memory version_) external {
        if (!_isMetadataInitialized()) {
            revert ErrorMetadataIsNotInitialized();
        }
        _initialize_v2(name_, version_);
    }

    function _initialize_v2(string memory name_, string memory version_) internal {
        _initializeContractVersionTo(2);
        _initializeEIP5267Metadata(name_, version_);
    }

    /// @inheritdoc PermitExtension
    function _permitAccepted(address owner_, address spender_, uint256 amount_) internal override {
        _approve(owner_, spender_, amount_);
    }

    error ErrorMetadataIsNotInitialized();
    error ErrorMetadataIsAlreadyInitialized();
}
