// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @author psirex
/// @notice Upgradable version of contract that contains the optional metadata functions from the ERC20 standard
/// @dev Uses the UnstructuredStorage pattern to store dynamic name and symbol data.
/// Might be used with the upgradable proxies
contract ERC20MetadataUpgradeable is IERC20Metadata, Initializable {
    /// @dev Stores the dynamic metadata of the ERC20 token. Allows safely use of this
    ///     contract with upgradable proxies
    struct DynamicMetadata {
        string name;
        string symbol;
    }

    /// @dev Location of the slot with DynamicMetdata
    bytes32 private constant DYNAMIC_METADATA_SLOT =
        keccak256("ERC20Metdata.dynamicMetadata");

    /// @inheritdoc IERC20Metadata
    uint8 public decimals;

    /// @param name_ Name of the token
    /// @param symbol_ Symbol of the token
    /// @param decimals_ Decimals places of the token
    function __ERC20Metadata_init(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) internal onlyInitializing {
        __ERC20Metadata_init_unchained(name_, symbol_, decimals_);
    }

    function __ERC20Metadata_init_unchained(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) internal onlyInitializing {
        decimals = decimals_;
        _setERC20MetadataName(name_);
        _setERC20MetadataSymbol(symbol_);
    }

    /// @inheritdoc IERC20Metadata
    function name() public view returns (string memory) {
        return _loadDynamicMetadata().name;
    }

    /// @inheritdoc IERC20Metadata
    function symbol() public view returns (string memory) {
        return _loadDynamicMetadata().symbol;
    }

    /// @dev Sets the name of the token. Might be called only when the name is empty
    function _setERC20MetadataName(string memory name_) internal {
        if (bytes(name()).length > 0) {
            revert ErrorNameAlreadySet();
        }
        _loadDynamicMetadata().name = name_;
    }

    /// @dev Sets the symbol of the token. Might be called only when the symbol is empty
    function _setERC20MetadataSymbol(string memory symbol_) internal {
        if (bytes(symbol()).length > 0) {
            revert ErrorSymbolAlreadySet();
        }
        _loadDynamicMetadata().symbol = symbol_;
    }

    /// @dev Returns the reference to the slot with DynamicMetadta struct
    function _loadDynamicMetadata()
        private
        pure
        returns (DynamicMetadata storage r)
    {
        bytes32 slot = DYNAMIC_METADATA_SLOT;
        assembly {
            r.slot := slot
        }
    }

    error ErrorNameAlreadySet();
    error ErrorSymbolAlreadySet();
}
