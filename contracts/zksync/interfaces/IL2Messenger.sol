// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @author mpavlovic-txfusion
 * @notice Smart contract for sending arbitrary length messages to L1
 * @dev by default ZkSync can send fixed length messages on L1.
 * A fixed length message has 4 parameters `senderAddress` `isService`, `key`, `value`,
 * the first one is taken from the context, the other three are chosen by the sender.
 * @dev To send a variable length message we use this trick:
 * - This system contract accepts a arbitrary length message and sends a fixed length message with
 * parameters `senderAddress == this`, `marker == true`, `key == msg.sender`, `value == keccak256(message)`.
 * - The contract on L1 accepts all sent messages and if the message came from this system contract
 * it requires that the preimage of `value` be provided.
 */
interface IL2Messenger {
    function sendToL1(bytes memory _message) external returns (bytes32);
}
