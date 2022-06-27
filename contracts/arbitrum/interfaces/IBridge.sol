// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.10;

interface IBridge {
    function activeOutbox() external view returns (address);
}
