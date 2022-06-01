// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.4.21;

import {ITokenGatewayCommon} from "./ITokenGatewayCommon.sol";

interface IL2TokenGateway is ITokenGatewayCommon {
    function outboundTransfer(
        address _token,
        address _to,
        uint256 _amount,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external returns (bytes memory);

    event DepositFinalized(
        address indexed l1Token,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event WithdrawalInitiated(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed l2ToL1Id,
        uint256 exitNum,
        uint256 amount
    );
}
