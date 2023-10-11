// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IERC20Wrapable} from "./interfaces/IERC20Wrapable.sol";
import {ITokensRateOracle} from "./interfaces/ITokensRateOracle.sol";

import {ERC20Core} from "./ERC20Core.sol";
import {ERC20Metadata} from "./ERC20Metadata.sol";

/// @author kovalgek
/// @notice Extends the ERC20Core functionality
contract ERC20Rebasable is IERC20Wrapable, ERC20Core, ERC20Metadata {

    IERC20 public immutable wrappedToken;
    ITokensRateOracle public immutable tokensRateOracle;

    /// @param wrappedToken_ address of the ERC20 token to wrap
    /// @param tokensRateOracle_ address of oracle that returns tokens rate
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    constructor(
        IERC20 wrappedToken_,
        ITokensRateOracle tokensRateOracle_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20Metadata(name_, symbol_, decimals_) {
        wrappedToken = wrappedToken_;
        tokensRateOracle = tokensRateOracle_;
    }

    /// @notice Sets the name and the symbol of the tokens if they both are empty
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    function initialize(string memory name_, string memory symbol_) external {
        _setERC20MetadataName(name_);
        _setERC20MetadataSymbol(symbol_);
    }

    /// @inheritdoc IERC20Wrapable
    function wrap(uint256 wstETHAmount_) external returns (uint256) {
        require(wstETHAmount_ > 0, "stETH: can't wrap zero wstETH");
        uint256 stETHAmount = wstETHAmount_ / tokensRateOracle.wstETH_to_stETH_rate(); // check how to divide.
        // 
        _mint(msg.sender, stETHAmount);
        wrappedToken.transferFrom(msg.sender, address(this), wstETHAmount_);
        return stETHAmount;
    }

    // tests when rate is different <1, >1.

    /// @inheritdoc IERC20Wrapable
    function unwrap(uint256 stETHAmount_) external returns (uint256) {
        require(stETHAmount_ > 0, "stETH: zero amount unwrap not allowed");
        uint256 wstETHAmount = stETHAmount_ * tokensRateOracle.wstETH_to_stETH_rate();
        _burn(msg.sender, stETHAmount_);
        wrappedToken.transfer(msg.sender, wstETHAmount);
        return wstETHAmount;
    }
}