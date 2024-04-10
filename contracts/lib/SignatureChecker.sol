// SPDX-FileCopyrightText: 2024 OpenZeppelin, Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0
// Written based on (utils/cryptography/SignatureChecker.sol from d398d68

pragma solidity 0.8.10;

import {ECDSA} from "@openzeppelin/contracts-v4.9/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts-v4.9/interfaces/IERC1271.sol";



/**
 * @dev Signature verification helper that can be used instead of `ECDSA.recover` to seamlessly support both ECDSA
 * signatures from externally owned accounts (EOAs) as well as ERC-1271 signatures from smart contract wallets like
 * Argent and Safe Wallet (previously Gnosis Safe).
 */
library SignatureChecker {
    /**
     * @dev Checks if a signature is valid for a given signer and data hash. If the signer is a smart contract, the
     * signature is validated against that smart contract using ERC-1271, otherwise it's validated using `ECDSA.recover`.
     *
     * NOTE: Unlike ECDSA signatures, contract signatures are revocable, and the outcome of this function can thus
     * change through time. It could return true at block N and false at block N+1 (or the opposite).
     */
    function isValidSignatureNow(address signer, bytes32 hash, bytes memory signature) internal view returns (bool) {
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError err) = ECDSA.tryRecover(hash, signature);
            return err == ECDSA.RecoverError.NoError && recovered == signer;
        } else {
            return isValidERC1271SignatureNow(signer, hash, signature);
        }
    }

    /**
     * @dev Checks signature validity.
     *
     * If the signer address doesn't contain any code, assumes that the address is externally owned
     * and the signature is a ECDSA signature generated using its private key. Otherwise, issues a
     * static call to the signer address to check the signature validity using the ERC-1271 standard.
     */
    function isValidSignatureNow(
        address signer,
        bytes32 msgHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view returns (bool) {
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError err) = ECDSA.tryRecover(msgHash, v, r, s);
            return err == ECDSA.RecoverError.NoError && recovered == signer;
        } else {
            bytes memory signature = abi.encodePacked(r, s, v);
            return isValidERC1271SignatureNow(signer, msgHash, signature);
        }
    }

    /**
     * @dev Checks if a signature is valid for a given signer and data hash. The signature is validated
     * against the signer smart contract using ERC-1271.
     *
     * NOTE: Unlike ECDSA signatures, contract signatures are revocable, and the outcome of this function can thus
     * change through time. It could return true at block N and false at block N+1 (or the opposite).
     */
    function isValidERC1271SignatureNow(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        (bool success, bytes memory result) = signer.staticcall(
            abi.encodeWithSelector(IERC1271.isValidSignature.selector, hash, signature)
        );
        return (success &&
            result.length >= 32 &&
            abi.decode(result, (bytes32)) == bytes32(IERC1271.isValidSignature.selector));
    }
}
