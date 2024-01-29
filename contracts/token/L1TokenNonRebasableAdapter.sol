// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20TokenRate} from "../token/interfaces/IERC20TokenRate.sol";
import {IERC20WstETH} from "../token/interfaces/IERC20WstETH.sol";

/// @author kovalgek
/// @notice Hides wstETH concept from other contracts to save level of abstraction.
contract L1TokenNonRebasableAdapter is IERC20TokenRate {

    IERC20WstETH public immutable WSTETH;

    constructor(address wstETH_) {
        WSTETH = IERC20WstETH(wstETH_);
    }

    /// @inheritdoc IERC20TokenRate
    function tokenRate() external view returns (uint256) {
        return WSTETH.stETHPerToken();
    }
}
