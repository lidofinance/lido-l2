// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {ITokenRatePusher} from "../lido/interfaces/ITokenRatePusher.sol";
import {ITokenRateUpdatable} from "../optimism/interfaces/ITokenRateUpdatable.sol";
import {TokenRateAndUpdateTimestampProvider} from "./TokenRateAndUpdateTimestampProvider.sol";

/// @author kovalgek
/// @notice Pushes token rate to L2 Oracle.
contract OpStackTokenRatePusher is ITokenRatePusher, CrossDomainEnabled, TokenRateAndUpdateTimestampProvider, ERC165 {

    /// @notice Oracle address on L2 for receiving token rate.
    address public immutable L2_TOKEN_RATE_ORACLE;

    /// @notice Gas limit for L2 required to finish pushing token rate on L2 side.
    ///         Client pays for gas on L2 by burning it on L1.
    ///         Depends linearly on deposit data length and gas used for finalizing deposit on L2.
    ///         Formula to find value:
    ///         (gas cost of L2Bridge.finalizeDeposit() + OptimismPortal.minimumGasLimit(depositData.length)) * 1.5
    uint32 public immutable L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE;

    /// @param messenger_ L1 messenger address being used for cross-chain communications.
    /// @param wstETH_ L1 token bridge address.
    /// @param accountingOracle_ Address of the AccountingOracle instance to retrieve rate update timestamps.
    /// @param tokenRateOracle_ Oracle address on L2 for receiving token rate.
    /// @param l2GasLimitForPushingTokenRate_ Gas limit required to complete pushing token rate on L2.
    constructor(
        address messenger_,
        address wstETH_,
        address accountingOracle_,
        address tokenRateOracle_,
        uint32 l2GasLimitForPushingTokenRate_
    ) CrossDomainEnabled(messenger_) TokenRateAndUpdateTimestampProvider(wstETH_, accountingOracle_) {
        if (tokenRateOracle_ == address(0)) {
            revert ErrorZeroAddressTokenRateOracle();
        }
        L2_TOKEN_RATE_ORACLE = tokenRateOracle_;
        L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE = l2GasLimitForPushingTokenRate_;
    }

    /// @inheritdoc ITokenRatePusher
    function pushTokenRate() external {
        (uint256 rate, uint256 updateTimestamp) = _getTokenRateAndUpdateTimestamp();

        bytes memory message = abi.encodeWithSelector(ITokenRateUpdatable.updateRate.selector, rate, updateTimestamp);

        sendCrossDomainMessage(L2_TOKEN_RATE_ORACLE, L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE, message);
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return (
            _interfaceId == type(ITokenRatePusher).interfaceId
            || super.supportsInterface(_interfaceId)
        );
    }

    error ErrorZeroAddressTokenRateOracle();
}
