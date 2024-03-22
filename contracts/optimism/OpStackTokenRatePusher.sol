// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {ITokenRatePusher} from "../lido/interfaces/ITokenRatePusher.sol";
import {IERC20WstETH} from "../token/interfaces/IERC20WstETH.sol";
import {ITokenRateOracle} from "../token/interfaces/ITokenRateOracle.sol";

/// @author kovalgek
/// @notice Pushes token rate to L2 Oracle.
contract OpStackTokenRatePusher is CrossDomainEnabled, ITokenRatePusher {

    /// @notice Oracle address on L2 for receiving token rate.
    address public immutable L2_TOKEN_RATE_ORACLE;

    /// @notice Non-rebasable token of Core Lido procotol.
    address public immutable WSTETH;

    /// @notice Gas limit required to complete pushing token rate on L2.
    uint32 public immutable L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE;

    /// @param messenger_ L1 messenger address being used for cross-chain communications
    /// @param wstEth_ Non-rebasable token of Core Lido procotol.
    /// @param tokenRateOracle_ Oracle address on L2 for receiving token rate.
    /// @param l2GasLimitForPushingTokenRate_ Gas limit required to complete pushing token rate on L2.
    constructor(
        address messenger_,
        address wstEth_,
        address tokenRateOracle_,
        uint32 l2GasLimitForPushingTokenRate_
    ) CrossDomainEnabled(messenger_) {
        WSTETH = wstEth_;
        L2_TOKEN_RATE_ORACLE = tokenRateOracle_;
        L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE = l2GasLimitForPushingTokenRate_;
    }

    /// @inheritdoc ITokenRatePusher
    function pushTokenRate() external {
        uint256 tokenRate = IERC20WstETH(WSTETH).stEthPerToken();

        bytes memory message = abi.encodeWithSelector(
            ITokenRateOracle.updateRate.selector,
            tokenRate,
            block.timestamp
        );

        sendCrossDomainMessage(L2_TOKEN_RATE_ORACLE, L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE, message);
    }
}
