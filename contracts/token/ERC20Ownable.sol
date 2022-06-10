// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {ERC20Core} from "./ERC20Core.sol";
import {IERC20Ownable} from "./interfaces/IERC20Ownable.sol";
import {ERC20MetadataImmutable} from "./ERC20MetadataImmutable.sol";
import "hardhat/console.sol";

/// @author psirex
/// @notice Extends the ERC20 functionality that allows the owner to mint/burn tokens
contract ERC20Ownable is IERC20Ownable, ERC20Core, ERC20MetadataImmutable {
    /// @notice An owner of the token who can mint/burn tokens
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
    ) ERC20MetadataImmutable(name_, symbol_, decimals_) {
        owner = owner_;
    }

    /// @notice Creates amount_ tokens and assigns them to account_, increasing the total supply
    function mint(address account_, uint256 amount_) public onlyOwner {
        console.log("Pre minted");
        _mint(account_, amount_);
        console.log("Minted");
    }

    /// @notice Destroys amount_ tokens from account_, reducing the total supply.
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
