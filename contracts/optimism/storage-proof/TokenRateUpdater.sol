// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateOracle} from "../../token/interfaces/ITokenRateOracle.sol";
import {StateProofVerifier as Verifier} from "./StateProofVerifier.sol";
import {SafeMath} from "./SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import "hardhat/console.sol";

/// @author kovalgek
contract TokenRateUpdater {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    address constant public STETH_ADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    uint256 constant internal STETH_DEPOSIT_SIZE = 32 ether;
    /// @dev Reporting data that is more fresh than this number of blocks ago is prohibited
    uint256 constant public MIN_BLOCK_DELAY = 15;
    /**
     * @notice The timestamp of the proven pool state/price.
     */
    uint256 public timestamp;

    /// @dev keccak256("lido.StETH.totalShares")
    bytes32 constant public STETH_TOTAL_SHARES_POS = 0xe3b4b636e601189b5f4c6742edf2538ac12bb61ed03e6da26949d69838fa447e;

    /// @dev keccak256("lido.Lido.beaconBalance")
    bytes32 constant public STETH_BEACON_BALANCE_POS = 0xa66d35f054e68143c18f32c990ed5cb972bb68a68f500cd2dd3a16bbf3686483;

    /// @dev keccak256("lido.Lido.bufferedEther")
    bytes32 constant public STETH_BUFFERED_ETHER_POS = 0xed310af23f61f96daefbcd140b306c0bdbf8c178398299741687b90e794772b0;

    /// @dev keccak256("lido.Lido.depositedValidators")
    bytes32 constant public STETH_DEPOSITED_VALIDATORS_POS = 0xe6e35175eb53fc006520a2a9c3e9711a7c00de6ff2c32dd31df8c5a24cac1b5c;

    /// @dev keccak256("lido.Lido.beaconValidators")
    bytes32 constant public STETH_BEACON_VALIDATORS_POS = 0x9f70001d82b6ef54e9d3725b46581c3eb9ee3aa02b941b6aa54d678a9ca35b10;

    /// @notice A bridge which can update oracle.
    ITokenRateOracle public immutable TOKEN_RATE_ORACLE;

    constructor(address tokenRateOracle_) {
        TOKEN_RATE_ORACLE = ITokenRateOracle(tokenRateOracle_);
    }

    /**
     * @notice Returns a set of values used by the clients for proof generation.
     */
    function getProofParams() external pure returns (
        address stethAddress,
        bytes32 stethTotalSharesPos,
        bytes32 stethBeaconBalancePos,
        bytes32 stethBufferedEtherPos,
        bytes32 stethDepositedValidatorsPos,
        bytes32 stethBeaconValidatorsPos
    ) {
        return (
            STETH_ADDRESS,
            STETH_TOTAL_SHARES_POS,
            STETH_BEACON_BALANCE_POS,
            STETH_BUFFERED_ETHER_POS,
            STETH_DEPOSITED_VALIDATORS_POS,
            STETH_BEACON_VALIDATORS_POS
        );
    }

    /**
     * @notice Used by the offchain clients to submit the proof.
     *
     * @dev Reverts unless:
     *   - the block the submitted data corresponds to is in the chain;
     *   - the block is at least `MIN_BLOCK_DELAY` blocks old;
     *   - all submitted proofs are valid.
     *
     * @param _blockHeaderRlpBytes RLP-encoded block header.
     *
     * @param _proofRlpBytes RLP-encoded list of Merkle Patricia proofs:
     *    1. proof of the stETH contract account;
     *    2. proof of the `keccak256("lido.StETH.totalShares")` slot of stETH contract;
     *    3. proof of the `keccak256("lido.Lido.beaconBalance")` slot of stETH contract;
     *    4. proof of the `keccak256("lido.Lido.bufferedEther")` slot of stETH contract;
     *    5. proof of the `keccak256("lido.Lido.depositedValidators")` slot of stETH contract;
     *    6. proof of the `keccak256("lido.Lido.beaconValidators")` slot of stETH contract.
     */
    function submitState(bytes memory _blockHeaderRlpBytes, bytes memory _proofRlpBytes) external {

        console.log("submitState1");
        Verifier.BlockHeader memory blockHeader = Verifier.verifyBlockHeader(_blockHeaderRlpBytes);
        console.log("submitState2");

        {
            uint256 currentBlock = block.number;
            // ensure block finality
            require(
                currentBlock > blockHeader.number &&
                currentBlock - blockHeader.number >= MIN_BLOCK_DELAY,
                "block too fresh"
            );
        }
        console.log("submitState3");

        // require(blockHeader.timestamp > timestamp, "stale data");

        // RLPReader.RLPItem[] memory proofs = _proofRlpBytes.toRlpItem().toList();
        // require(proofs.length == 10, "total proofs");
    }

    // premissionless token rate update
    function updateTokenRate() external {
        uint256 tokenRate = 1 ** 18;
        uint256 rateL1Timestamp = block.timestamp;
        TOKEN_RATE_ORACLE.updateRate(tokenRate, rateL1Timestamp);
    }
}
