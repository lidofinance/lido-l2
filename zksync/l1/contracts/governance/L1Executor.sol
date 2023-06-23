// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";

contract L1Executor {
    function callZkSync(
        address zkSyncAddress,
        address contractAddr,
        bytes memory data,
        uint256 gasLimit,
        uint256 gasPerPubdataByteLimit
    ) external payable {
        IZkSync zksync = IZkSync(zkSyncAddress);
        zksync.requestL2Transaction{value: msg.value}(
            contractAddr,
            0,
            data,
            gasLimit,
            gasPerPubdataByteLimit,
            new bytes[](0),
            msg.sender
        );
    }
}
