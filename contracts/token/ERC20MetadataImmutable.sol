// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";

uint8 constant BYTES32_SIZE = 32;
uint8 constant MAX_NAME_AND_SYMBOL_LENGTH = 2 * BYTES32_SIZE;

/// @author psirex
/// @notice Contains the optional metadata functions from the ERC20 standard
/// @dev All the metadata variables are stored as immutable variables
contract ERC20MetadataImmutable is IERC20Metadata {
    /// @notice The decimals places of the token.
    uint8 public immutable decimals;

    /// @dev The length of the name string of the token
    uint8 private immutable _nameLength;

    /// @dev The symbol of the name string of the token
    uint8 private immutable _symbolLength;

    /// @dev Following variables store the string with concatenated name and symbol values
    bytes32 private immutable _nameAndSymbolData1;
    bytes32 private immutable _nameAndSymbolData2;

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    /// @dev The total length of name_ and symbol_ strings MUST be less or equal to 64
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        decimals = decimals_;
        _nameLength = uint8(bytes(name_).length);
        _symbolLength = uint8(bytes(symbol_).length);

        if (_nameLength + _symbolLength > MAX_NAME_AND_SYMBOL_LENGTH) {
            revert ErrorNameAndSymbolTooLong();
        }

        (_nameAndSymbolData1, _nameAndSymbolData2) = _encodeNameAndSymbol(
            name_,
            symbol_
        );
    }

    /// @notice Returns the name of the token
    function name() public view returns (string memory) {
        bytes memory decodedName = new bytes(_nameLength);
        bytes memory data = abi.encodePacked(
            _nameAndSymbolData1,
            _nameAndSymbolData2
        );
        assembly {
            mstore(
                add(decodedName, BYTES32_SIZE),
                mload(add(data, BYTES32_SIZE))
            )
        }
        return string(decodedName);
    }

    /// @notice Returns the symbol of the token
    function symbol() public view returns (string memory) {
        bytes memory decodedSymbol = new bytes(_symbolLength);
        bytes memory data = abi.encodePacked(
            _nameAndSymbolData1,
            _nameAndSymbolData2
        );
        uint256 offset = _nameLength;
        assembly {
            mstore(
                add(decodedSymbol, BYTES32_SIZE),
                mload(add(data, add(BYTES32_SIZE, offset)))
            )
        }
        return string(decodedSymbol);
    }

    /// @dev Concatenates the name_ and symbol_ strings and encodes them as two bytes32 variables
    function _encodeNameAndSymbol(string memory name_, string memory symbol_)
        private
        pure
        returns (bytes32 s1, bytes32 s2)
    {
        bytes memory data = abi.encodePacked(name_, symbol_);
        assembly {
            let offset := BYTES32_SIZE
            s1 := mload(add(data, offset))
            offset := add(offset, BYTES32_SIZE)
            s2 := mload(add(data, offset))
        }
    }

    error ErrorNameAndSymbolTooLong();
}
