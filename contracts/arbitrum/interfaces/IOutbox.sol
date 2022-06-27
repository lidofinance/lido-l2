// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.10;

interface IOutbox {
    function l2ToL1Sender() external view returns (address);
}
