// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.4.21;

import {ITokenGatewayCommon} from "./ITokenGatewayCommon.sol";

interface IL1TokenGateway is ITokenGatewayCommon {
    function outboundTransfer(
        address _token,
        address _to,
        uint256 _amount,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable returns (bytes memory);

    event DepositInitiated(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed sequenceNumber,
        uint256 amount
    );

    event WithdrawalFinalized(
        address l1Token,
        address indexed from,
        address indexed to,
        uint256 indexed exitNum,
        uint256 amount
    );
}
