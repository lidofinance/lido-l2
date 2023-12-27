// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

contract DepositDataCodec {
    
    struct DepositData {
        uint96 rate;
        uint40 time;
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
        
        if (buffer.length < 12 + 5) {
            revert ErrorDepositDataLength();
        }
        
        DepositData memory depositData = DepositData({
            rate: uint96(bytes12(buffer[0:12])),
            time: uint40(bytes5(buffer[12:17])),
            data: buffer[17:]
        });

        return depositData;
    }

    error ErrorDepositDataLength();
}