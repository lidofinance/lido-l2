// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.4.21;

interface IOutbox {
    function l2ToL1Sender() external view returns (address);
}
