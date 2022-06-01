// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {ERC20Core} from "./ERC20Core.sol";
import {IERC20Ownable} from "./interfaces/IERC20Ownable.sol";
import {ERC20ImmutableInfo} from "./ERC20ImmutableInfo.sol";

contract ERC20Ownable is IERC20Ownable, ERC20Core, ERC20ImmutableInfo {
    address public immutable owner;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address owner_
    ) ERC20ImmutableInfo(name_, symbol_, decimals_) {
        owner = owner_;
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert ErrorNotOwner();
        }
        _;
    }

    error ErrorNotOwner();
}
