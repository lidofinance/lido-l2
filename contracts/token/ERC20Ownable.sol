// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {IERC20Ownable} from "./interfaces/IERC20Ownable.sol";

import {ERC20Core} from "./ERC20Core.sol";
import {ERC20Metadata} from "./ERC20Metadata.sol";

/// @author psirex
/// @notice Extends the ERC20 functionality that allows the owner to mint/burn tokens
contract ERC20Ownable is IERC20Ownable, ERC20Core, ERC20Metadata {
    /// @inheritdoc IERC20Ownable
    address public immutable owner;

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    /// @param owner_ The owner of the token
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address owner_
    ) ERC20Metadata(name_, symbol_, decimals_) {
        owner = owner_;
    }

    /// @notice Sets the name and the symbol of the tokens if they both are empty
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    function initialize(string memory name_, string memory symbol_) external {
        _setERC20MetadataName(name_);
        _setERC20MetadataSymbol(symbol_);
    }

    /// @inheritdoc IERC20Ownable
    function mint(address account_, uint256 amount_) public onlyOwner {
        _mint(account_, amount_);
    }

    /// @inheritdoc IERC20Ownable
    function burn(address account_, uint256 amount_) external onlyOwner {
        _burn(account_, amount_);
    }

    /// @dev Validates that sender of the transaction is the owner
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert ErrorNotOwner();
        }
        _;
    }

    error ErrorNotOwner();
}
