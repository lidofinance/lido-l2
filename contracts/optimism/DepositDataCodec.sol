// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

contract DepositDataCodec {
    
    struct DepositData {
        uint256 rate;
        uint256 time;
        bytes data;
    }

    function encodeDepositData(DepositData memory depositData) internal pure returns (bytes memory) {
        bytes memory data = bytes.concat(
            abi.encodePacked(depositData.rate),
            abi.encodePacked(depositData.time),
            abi.encodePacked(depositData.data)
        );
        return data;
    }

    function decodeDepositData(bytes calldata buffer) internal pure returns (DepositData memory) {
        
        if (buffer.length < 32 * 2) {
            revert ErrorDepositDataLength();
        }
        
        DepositData memory depositData = DepositData({
            rate: uint256(bytes32(buffer[0:32])),
            time: uint256(bytes32(buffer[32:64])),
            data: buffer[64:]
        });

        return depositData;
    }

    error ErrorDepositDataLength();
}