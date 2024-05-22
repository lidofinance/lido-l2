// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20Bridged} from "../token/ERC20Bridged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20WstETH} from "../optimism/TokenRateAndUpdateTimestampProvider.sol";
import {IERC20Wrapper} from "../token/interfaces/IERC20Wrapper.sol";

/// @dev represents wstETH on L1. For testing purposes.
contract ERC20WrapperStub is IERC20Wrapper, IERC20WstETH, ERC20 {

    IERC20 public stETH;
    address public bridge;
    uint256 private immutable TOTAL_POOLED_ETHER;
    uint256 private immutable TOTAL_SHARES;
    uint256 private decimalsShift = 0;

    constructor(
        IERC20 stETH_,
        string memory name_,
        string memory symbol_,
        uint256 totalPooledEther_,
        uint256 totalShares_
    ) ERC20(name_, symbol_) {
        stETH = stETH_;
        TOTAL_POOLED_ETHER = totalPooledEther_;
        TOTAL_SHARES = totalShares_;
        _mint(msg.sender, 1000000 * 10**40);
    }

    function wrap(uint256 _stETHAmount) external returns (uint256) {
        require(_stETHAmount > 0, "wstETH: can't wrap zero stETH");

        uint256 wstETHAmount = _getSharesByPooledEth(_stETHAmount);

        _mint(msg.sender, wstETHAmount);
        stETH.transferFrom(msg.sender, address(this), _stETHAmount);

        return wstETHAmount;
    }

    function unwrap(uint256 _wstETHAmount) external returns (uint256) {
        require(_wstETHAmount > 0, "wstETH: zero amount unwrap not allowed");

        uint256 stETHAmount = _getPooledEthByShares(_wstETHAmount);

        _burn(msg.sender, _wstETHAmount);
        stETH.transfer(msg.sender, stETHAmount);

        return stETHAmount;
    }

    function getStETHByWstETH(uint256 wstETHAmount_) external view returns (uint256) {
        uint256 wstETHAmount = wstETHAmount_ - decimalsShift;
        return _getPooledEthByShares(wstETHAmount);
    }

    function _getPooledEthByShares(uint256 sharesAmount_) internal view returns (uint256) {
        return sharesAmount_ * TOTAL_POOLED_ETHER / TOTAL_SHARES;
    }

    function getWstETHByStETH(uint256 stETHAmount_) external view returns (uint256) {
        return _getSharesByPooledEth(stETHAmount_);
    }

    function _getSharesByPooledEth(uint256 ethAmount_) internal view returns (uint256) {
        return ethAmount_ *  TOTAL_SHARES / TOTAL_POOLED_ETHER;
    }

    function setDecimalsShift(uint256 decimalsShift_) external {
        decimalsShift = decimalsShift_;
    }
}
