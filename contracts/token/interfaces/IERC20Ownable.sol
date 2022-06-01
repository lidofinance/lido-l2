// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Ownable is IERC20 {
    function owner() external view returns (address);

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;
}
