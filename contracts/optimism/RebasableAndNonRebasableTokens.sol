// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {UnstructuredRefStorage} from "../token/UnstructuredRefStorage.sol";

/// @author psirex, kovalgek
/// @notice Contains the logic for validation of tokens used in the bridging process
contract RebasableAndNonRebasableTokens {
    using UnstructuredRefStorage for bytes32;

    /// @dev Servers for pairing tokens by one-layer and wrapping.
    /// @param `oppositeLayerToken` token representation on opposite layer.
    /// @param `pairedToken` paired token address on the same domain.
    struct TokenInfo {
        address oppositeLayerToken;
        address pairedToken;
    }

    bytes32 internal constant REBASABLE_TOKENS_POSITION = keccak256("RebasableAndNonRebasableTokens.REBASABLE_TOKENS_POSITION");
    bytes32 internal constant NON_REBASABLE_TOKENS_POSITION = keccak256("RebasableAndNonRebasableTokens.NON_REBASABLE_TOKENS_POSITION");

    function _getRebasableTokens() internal pure returns (mapping(address => TokenInfo) storage) {
        return _storageMapAddressTokenInfo(REBASABLE_TOKENS_POSITION);
    }

    function _getNonRebasableTokens() internal pure returns (mapping(address => TokenInfo) storage) {
        return _storageMapAddressTokenInfo(REBASABLE_TOKENS_POSITION);
    }

    function _storageMapAddressTokenInfo(bytes32 _position) internal pure returns (
        mapping(address => TokenInfo) storage result
    ) {
        assembly { result.slot := _position }
    }

    /// @param l1TokenNonRebasable_ Address of the bridged non rebasable token in the L1 chain
    /// @param l1TokenRebasable_ Address of the bridged rebasable token in the L1 chain
    /// @param l2TokenNonRebasable_ Address of the non rebasable token minted on the L2 chain when token bridged
    /// @param l2TokenRebasable_ Address of the rebasable token minted on the L2 chain when token bridged
    constructor(
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) {
        _getRebasableTokens()[l1TokenRebasable_] = TokenInfo({
            oppositeLayerToken: l2TokenRebasable_,
            pairedToken: l1TokenNonRebasable_
        });
        _getRebasableTokens()[l2TokenRebasable_] = TokenInfo({
            oppositeLayerToken: l1TokenRebasable_,
            pairedToken: l2TokenNonRebasable_
        });
        _getNonRebasableTokens()[l1TokenNonRebasable_] = TokenInfo({
            oppositeLayerToken: l2TokenNonRebasable_,
            pairedToken: l1TokenRebasable_
        });
        _getNonRebasableTokens()[l2TokenNonRebasable_] = TokenInfo({
            oppositeLayerToken: l1TokenNonRebasable_,
            pairedToken: l2TokenRebasable_
        });
    }

    function initialize(
        address l1TokenNonRebasable_,
        address l1TokenRebasable_,
        address l2TokenNonRebasable_,
        address l2TokenRebasable_
    ) public {
        _getRebasableTokens()[l1TokenRebasable_] = TokenInfo({
            oppositeLayerToken: l2TokenRebasable_,
            pairedToken: l1TokenNonRebasable_
        });
        _getRebasableTokens()[l2TokenRebasable_] = TokenInfo({
            oppositeLayerToken: l1TokenRebasable_,
            pairedToken: l2TokenNonRebasable_
        });
        _getNonRebasableTokens()[l1TokenNonRebasable_] = TokenInfo({
            oppositeLayerToken: l2TokenNonRebasable_,
            pairedToken: l1TokenRebasable_
        });
        _getNonRebasableTokens()[l2TokenNonRebasable_] = TokenInfo({
            oppositeLayerToken: l1TokenNonRebasable_,
            pairedToken: l2TokenRebasable_
        });
    }

    /// @dev Validates that passed l1Token_ and l2Token_ tokens pair is supported by the bridge.
    modifier onlySupportedL1L2TokensPair(address l1Token_, address l2Token_) {
        if (_getRebasableTokens()[l1Token_].oppositeLayerToken == address(0) &&
            _getNonRebasableTokens()[l1Token_].oppositeLayerToken == address(0)) {
            revert ErrorUnsupportedL1Token();
        }
        if (_getRebasableTokens()[l2Token_].oppositeLayerToken == address(0) &&
            _getNonRebasableTokens()[l2Token_].oppositeLayerToken == address(0)) {
            revert ErrorUnsupportedL2Token();
        }
        if (_getRebasableTokens()[l1Token_].oppositeLayerToken != l2Token_ &&
            _getNonRebasableTokens()[l2Token_].oppositeLayerToken != l1Token_) {
            revert ErrorUnsupportedL1L2TokensPair();
        }
        _;
    }

    /// @dev Validates that passed l1Token_ is supported by the bridge
    modifier onlySupportedL1Token(address l1Token_) {
        if (_getRebasableTokens()[l1Token_].oppositeLayerToken == address(0) &&
            _getNonRebasableTokens()[l1Token_].oppositeLayerToken == address(0)) {
            revert ErrorUnsupportedL1Token();
        }
        _;
    }

    /// @dev Validates that passed l2Token_ is supported by the bridge
    modifier onlySupportedL2Token(address l2Token_) {
        if (_getRebasableTokens()[l2Token_].oppositeLayerToken == address(0) &&
            _getNonRebasableTokens()[l2Token_].oppositeLayerToken == address(0)) {
            revert ErrorUnsupportedL2Token();
        }
        _;
    }

    /// @dev validates that account_ is not zero address
    modifier onlyNonZeroAccount(address account_) {
        if (account_ == address(0)) {
            revert ErrorAccountIsZeroAddress();
        }
        _;
    }

    function _isRebasable(address token_) internal view returns (bool) {
        return _getRebasableTokens()[token_].oppositeLayerToken != address(0);
    }

    function _l1Token(address l2Token_) internal view returns (address) {
        return _isRebasable(l2Token_) ?
            _getRebasableTokens()[l2Token_].oppositeLayerToken :
            _getNonRebasableTokens()[l2Token_].oppositeLayerToken;
    }

    function _l1NonRebasableToken(address l1Token_) internal view returns (address) {
        return _isRebasable(l1Token_) ? _getRebasableTokens()[l1Token_].pairedToken : l1Token_;
    }

    error ErrorUnsupportedL1Token();
    error ErrorUnsupportedL2Token();
    error ErrorUnsupportedL1L2TokensPair();
    error ErrorAccountIsZeroAddress();
}
