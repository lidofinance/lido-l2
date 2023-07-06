// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract L1Executor is OwnableUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
    }

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
