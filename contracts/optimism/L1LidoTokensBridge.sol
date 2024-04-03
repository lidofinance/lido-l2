// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {L1ERC20TokenBridge} from "./L1ERC20TokenBridge.sol";
import {IERC20WstETH} from "../token/interfaces/IERC20WstETH.sol";

/// @author kovalgek
/// @notice Hides wstETH concept from other contracts to keep `L1ERC20TokenBridge` reusable.
contract L1LidoTokensBridge is L1ERC20TokenBridge {

    constructor(
        address messenger_,
        address l2TokenBridge_,
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) L1ERC20TokenBridge(
        messenger_,
        l2TokenBridge_,
        l1TokenNonRebasable_,
        l1TokenRebasable_,
        l2TokenNonRebasable_,
        l2TokenRebasable_
    ) {
    }

    function tokenRate() override internal view returns (uint256) {
        return IERC20WstETH(L1_TOKEN_NON_REBASABLE).stEthPerToken();
    }
}
