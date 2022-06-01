// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

contract ERC20ImmutableInfo {
    uint8 public immutable decimals;
    uint8 private immutable _nameLength;
    uint8 private immutable _symbolLength;
    bytes32 private immutable _nameAndSymbolData1;
    bytes32 private immutable _nameAndSymbolData2;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        decimals = decimals_;
        _nameLength = uint8(bytes(name_).length);
        _symbolLength = uint8(bytes(symbol_).length);
        (_nameAndSymbolData1, _nameAndSymbolData2) = _encodeNameAndSymbol(
            name_,
            symbol_
        );
    }

    function name() public view returns (string memory) {
        bytes memory decodedName = new bytes(_nameLength);
        bytes memory data = abi.encodePacked(
            _nameAndSymbolData1,
            _nameAndSymbolData2
        );
        assembly {
            mstore(add(decodedName, 32), mload(add(data, 32)))
        }
        return string(decodedName);
    }

    function symbol() public view returns (string memory) {
        bytes memory decodedSymbol = new bytes(_symbolLength);
        bytes memory data = abi.encodePacked(
            _nameAndSymbolData1,
            _nameAndSymbolData2
        );
        uint256 offset = _nameLength;
        assembly {
            mstore(add(decodedSymbol, 32), mload(add(data, add(32, offset))))
        }
        return string(decodedSymbol);
    }

    function _encodeNameAndSymbol(string memory name_, string memory symbol_)
        private
        pure
        returns (bytes32 s1, bytes32 s2)
    {
        bytes memory data = abi.encodePacked(name_, symbol_);
        assembly {
            s1 := mload(add(data, 32))
            s2 := mload(add(data, 64))
        }
    }
}
