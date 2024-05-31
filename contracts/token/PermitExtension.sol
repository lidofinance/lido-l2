// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC2612} from "@openzeppelin/contracts/interfaces/draft-IERC2612.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {UnstructuredRefStorage} from "../lib//UnstructuredRefStorage.sol";

/// @author arwer13, kovalgek
abstract contract PermitExtension is IERC2612, EIP712 {
    using UnstructuredRefStorage for bytes32;

    /// @dev Stores the dynamic metadata of the PermitExtension. Allows safely use of this
    ///     contract with upgradable proxies
    struct EIP5267Metadata {
        string name;
        string version;
    }

    /// @dev user nonce slot position.
    bytes32 internal constant NONCE_BY_ADDRESS_POSITION = keccak256("PermitExtension.NONCE_BY_ADDRESS_POSITION");

    /// @dev Typehash constant for ERC-2612 (Permit)
    /// keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
    bytes32 internal constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    /// @dev Location of the slot with EIP5267Metadata
    bytes32 private constant EIP5267_METADATA_SLOT = keccak256("PermitExtension.eip5267MetadataSlot");

    /// @param name_ The name of the token
    /// @param version_ The current major version of the signing domain (aka token version)
    constructor(string memory name_, string memory version_) EIP712(name_, version_) {
        _initializeEIP5267Metadata(name_, version_);
    }

    /// @notice Sets `value_` as the allowance of `spender_` over `owner_`'s tokens, given `owner_`'s signed approval.
    /// @param owner_  Token owner's address (Authorizer). Cannot be the zero address.
    /// @param spender_  An address of the tokens spender. Cannot be the zero address.
    /// @param value_ An amount of tokens to allow to spend.
    /// @param deadline_ The time at which the signature expires (unix time). Must be a timestamp in the future.
    /// @param v_, r_, s_ must be a valid `secp256k1` signature from `owner`
    ///                   over the EIP712-formatted function arguments.
    ///                   The signature must use ``owner``'s current nonce (see {nonces}).
    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) external {
        _permit(owner_, spender_, value_, deadline_, abi.encodePacked(r_, s_, v_));
    }

    /// @notice Sets `value_` as the allowance of `spender_` over `owner_`'s tokens, given `owner_`'s signed approval.
    /// @param owner_  Token owner's address (Authorizer). Cannot be the zero address.
    /// @param spender_  An address of the tokens spender. Cannot be the zero address.
    /// @param value_ An amount of tokens to allow to spend.
    /// @param deadline_ The time at which the signature expires (unix time). Must be a timestamp in the future.
    /// @param signature_ Unstructured bytes signature signed by an EOA wallet or a contract wallet.
    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        bytes calldata signature_
    ) external {
        _permit(owner_, spender_, value_, deadline_, signature_);
    }

    function _permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        bytes memory signature_
    ) internal {
        if (block.timestamp > deadline_) {
            revert ErrorDeadlineExpired();
        }

        bytes32 hash = _hashTypedDataV4(
            keccak256(
                abi.encode(PERMIT_TYPEHASH, owner_, spender_, value_, _useNonce(owner_), deadline_)
            )
        );

        if (!SignatureChecker.isValidSignatureNow(owner_, hash, signature_)) {
            revert ErrorInvalidSignature();
        }

        _permitAccepted(owner_, spender_, value_);
    }

    /// @dev Returns the current nonce for `owner`. This value must be
    /// included whenever a signature is generated for {permit}.
    ///
    /// Every successful call to {permit} increases ``owner``'s nonce by one. This
    /// prevents a signature from being used multiple times.
    ///
    function nonces(address owner) external view returns (uint256) {
        return _getNonceByAddress()[owner];
    }

    /// @dev Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @dev EIP-5267. Returns the fields and values that describe the domain separator
    /// used by this contract for EIP-712 signature.
    function eip712Domain()
        external
        view
        virtual
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        )
    {
        return (
            hex"0f", // 01111
            _loadEIP5267Metadata().name,
            _loadEIP5267Metadata().version,
            block.chainid,
            address(this),
            bytes32(0),
            new uint256[](0)
        );
    }

    /// @notice Sets the name and the version of the tokens if they both are empty
    /// @param name_ The name of the token
    /// @param version_ The version of the token
    function _initializeEIP5267Metadata(string memory name_, string memory version_) internal {
        _setEIP5267MetadataName(name_);
        _setEIP5267MetadataVersion(version_);
    }

    /// @dev "Consume a nonce": return the current value and increment.
    function _useNonce(address _owner) internal returns (uint256 current) {
        current = _getNonceByAddress()[_owner];
        _getNonceByAddress()[_owner] = current + 1;
    }

    /// @notice Nonces for ERC-2612 (Permit)
    function _getNonceByAddress() internal pure returns (mapping(address => uint256) storage) {
        return NONCE_BY_ADDRESS_POSITION.storageMapAddressAddressUint256();
    }

    /// @dev Override this function in the inherited contract to invoke the approve() function of ERC20.
    function _permitAccepted(address owner_, address spender_, uint256 amount_) internal virtual;

    /// @dev Sets the name of the token. Might be called only when the name is empty
    function _setEIP5267MetadataName(string memory name_) internal {
        _loadEIP5267Metadata().name = name_;
    }

    /// @dev Sets the version of the token. Might be called only when the version is empty
    function _setEIP5267MetadataVersion(string memory version_) internal {
        _loadEIP5267Metadata().version = version_;
    }

    /// @dev Returns the reference to the slot with EIP5267Metadata struct
    function _loadEIP5267Metadata() private pure returns (EIP5267Metadata storage r) {
        bytes32 slot = EIP5267_METADATA_SLOT;
        assembly {
            r.slot := slot
        }
    }

    error ErrorInvalidSignature();
    error ErrorDeadlineExpired();
}
