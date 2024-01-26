// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {MerklePatriciaProofVerifier} from "./MerklePatriciaProofVerifier.sol";
import "hardhat/console.sol";

/**
 * @title A helper library for verification of Merkle Patricia account and state proofs.
 */
library StateProofVerifier {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    uint256 constant HEADER_STATE_ROOT_INDEX = 3;
    uint256 constant HEADER_NUMBER_INDEX = 8;
    uint256 constant HEADER_TIMESTAMP_INDEX = 11;

    struct BlockHeader {
        bytes32 hash;
        bytes32 stateRootHash;
        uint256 number;
        uint256 timestamp;
    }

    struct Account {
        bool exists;
        uint256 nonce;
        uint256 balance;
        bytes32 storageRoot;
        bytes32 codeHash;
    }

    struct SlotValue {
        bool exists;
        uint256 value;
    }


    /**
     * @notice Parses block header and verifies its presence onchain within the latest 256 blocks.
     * @param _headerRlpBytes RLP-encoded block header.
     */
    function verifyBlockHeader(bytes memory _headerRlpBytes)
        internal view returns (BlockHeader memory)
    {
        console.log("verifyBlockHeader1");

        BlockHeader memory header = parseBlockHeader(_headerRlpBytes);
        console.log("verifyBlockHeader2");

        console.logBytes32(header.hash); // ("verifyBlockHeade2=%s", header.hash);
        console.log("header.number=", header.number);
        //console.log("blockhash(header.number)=", blockhash(header.number));

        // ensure that the block is actually in the blockchain
        require(header.hash == blockhash(header.number), "blockhash mismatch");

        console.log("verifyBlockHeade3");

        return header;
    }


    /**
     * @notice Parses RLP-encoded block header.
     * @param _headerRlpBytes RLP-encoded block header.
     */
    function parseBlockHeader(bytes memory _headerRlpBytes)
        internal view returns (BlockHeader memory)
    {
        BlockHeader memory result;
        RLPReader.RLPItem[] memory headerFields = _headerRlpBytes.toRlpItem().toList();

        for (uint256 headerFieldIdx = 0; headerFieldIdx < headerFields.length; headerFieldIdx++ ) {
            console.log(headerFields[headerFieldIdx].len);
        }
        console.log("parseBlockHeader1");

        require(headerFields.length > HEADER_TIMESTAMP_INDEX);
        console.log("parseBlockHeader2");
        console.log(headerFields[HEADER_STATE_ROOT_INDEX].toUint());
        console.log("parseBlockHeader2_");

        result.stateRootHash = bytes32(headerFields[HEADER_STATE_ROOT_INDEX].toUint());
                console.log("parseBlockHeader3");

        result.number = headerFields[HEADER_NUMBER_INDEX].toUint();
                console.log("parseBlockHeader4");

        result.timestamp = headerFields[HEADER_TIMESTAMP_INDEX].toUint();
                console.log("parseBlockHeader5");

        result.hash = keccak256(_headerRlpBytes);

        return result;
    }


    /**
     * @notice Verifies Merkle Patricia proof of an account and extracts the account fields.
     *
     * @param _addressHash Keccak256 hash of the address corresponding to the account.
     * @param _stateRootHash MPT root hash of the Ethereum state trie.
     */
    function extractAccountFromProof(
        bytes32 _addressHash, // keccak256(abi.encodePacked(address))
        bytes32 _stateRootHash,
        RLPReader.RLPItem[] memory _proof
    )
        internal pure returns (Account memory)
    {
        bytes memory acctRlpBytes = MerklePatriciaProofVerifier.extractProofValue(
            _stateRootHash,
            abi.encodePacked(_addressHash),
            _proof
        );

        Account memory account;

        if (acctRlpBytes.length == 0) {
            return account;
        }

        RLPReader.RLPItem[] memory acctFields = acctRlpBytes.toRlpItem().toList();
        require(acctFields.length == 4);

        account.exists = true;
        account.nonce = acctFields[0].toUint();
        account.balance = acctFields[1].toUint();
        account.storageRoot = bytes32(acctFields[2].toUint());
        account.codeHash = bytes32(acctFields[3].toUint());

        return account;
    }


    /**
     * @notice Verifies Merkle Patricia proof of a slot and extracts the slot's value.
     *
     * @param _slotHash Keccak256 hash of the slot position.
     * @param _storageRootHash MPT root hash of the account's storage trie.
     */
    function extractSlotValueFromProof(
        bytes32 _slotHash,
        bytes32 _storageRootHash,
        RLPReader.RLPItem[] memory _proof
    )
        internal pure returns (SlotValue memory)
    {
        bytes memory valueRlpBytes = MerklePatriciaProofVerifier.extractProofValue(
            _storageRootHash,
            abi.encodePacked(_slotHash),
            _proof
        );

        SlotValue memory value;

        if (valueRlpBytes.length != 0) {
            value.exists = true;
            value.value = valueRlpBytes.toRlpItem().toUint();
        }

        return value;
    }

}
