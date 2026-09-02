// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Core} from "./ERC20Core.sol";
import {ERC20Metadata} from "./ERC20Metadata.sol";

/// @author psirex, kovalgek
/// @notice Extends the ERC20 functionality that allows the bridge to mint/burn tokens
interface IERC20Bridged is IERC20 {
    /// @notice Returns bridge which can mint and burn tokens on L2
    function bridge() external view returns (address);

    /// @notice Creates `amount_` tokens and assigns them to `account_`, increasing the total supply
    /// @param account_ An address of the account to mint tokens
    /// @param amount_ An amount of tokens to mint
    function bridgeMint(address account_, uint256 amount_) external;

    /// @notice Destroys `amount_` tokens from `account_`, reducing the total supply
    /// @param account_ An address of the account to burn tokens
    /// @param amount_ An amount of tokens to burn
    function bridgeBurn(address account_, uint256 amount_) external;
}

/// @author psirex, kovalgek
/// @notice ERC20 with unstructured-storage metadata. Carries NO mint/burn authority of its own:
///     the `bridge` immutable and the `bridgeMint`/`bridgeBurn` pair are removed by
///     patches/lido-l2-with-steth/0001 — this deployment mints and burns exclusively through the
///     OZ AccessControl roles added by src/vendor/BurnMintERC20BridgedPermit.sol. `IERC20Bridged`
///     above is left declared so the submodule's own importers still resolve it.
contract ERC20Bridged is ERC20Core, ERC20Metadata {
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20Metadata(name_, symbol_, decimals_) {}

    /// @notice Sets the name and the symbol of the tokens if they both are empty
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    function _initializeERC20Metadata(string memory name_, string memory symbol_) internal {
        _setERC20MetadataName(name_);
        _setERC20MetadataSymbol(symbol_);
    }
}
