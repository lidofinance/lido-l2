// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author psirex
/// @notice Interface for the optional metadata functions from the ERC20 standard.
interface IERC20Metadata {
    /// @dev Returns the name of the token.
    function name() external view returns (string memory);

    /// @dev Returns the symbol of the token.
    function symbol() external view returns (string memory);

    /// @dev Returns the decimals places of the token.
    function decimals() external view returns (uint8);
}

/// @author psirex
/// @notice Contains the optional metadata functions from the ERC20 standard
/// @dev Uses the UnstructuredStorage pattern to store dynamic name and symbol data. Might be used
///     with the upgradable proxies
contract ERC20Metadata is IERC20Metadata {
    /// @dev Stores the dynamic metadata of the ERC20 token. Allows safely use of this
    ///     contract with upgradable proxies
    struct DynamicMetadata {
        string name;
        string symbol;
    }

    /// @dev Location of the slot with DynamicMetdata
    ///      The slot's index string has a misspelling, but the contract storage will be broken without it.
    bytes32 private constant DYNAMIC_METADATA_SLOT =
        keccak256("ERC20Metdata.dynamicMetadata");

    /// @inheritdoc IERC20Metadata
    uint8 public immutable decimals;

    /// @param name_ Name of the token
    /// @param symbol_ Symbol of the token
    /// @param decimals_ Decimals places of the token
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        if (decimals_ == 0) {
            revert ErrorZeroDecimals();
        }
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

    /// @dev Sets the name of the token.
    function _setERC20MetadataName(string memory name_) internal {
        if (bytes(name_).length == 0) {
            revert ErrorNameIsEmpty();
        }
        _loadDynamicMetadata().name = name_;
    }

    /// @dev Sets the symbol of the token.
    function _setERC20MetadataSymbol(string memory symbol_) internal {
        if (bytes(symbol_).length == 0) {
            revert ErrorSymbolIsEmpty();
        }
        _loadDynamicMetadata().symbol = symbol_;
    }

    function _isMetadataInitialized() internal view returns (bool) {
        return bytes(name()).length != 0 && bytes(symbol()).length != 0;
    }

    /// @dev Returns the reference to the slot with DynamicMetadata struct
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

    error ErrorZeroDecimals();
    error ErrorNameIsEmpty();
    error ErrorSymbolIsEmpty();
}
