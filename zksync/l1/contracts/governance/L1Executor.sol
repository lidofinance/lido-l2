// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract L1Executor is OwnableUpgradeable {
    constructor() {
        _disableInitializers();
    }

    IZkSync public zksync;

    function initialize(IZkSync _zksync) external initializer {
        __Ownable_init();
        zksync = _zksync;
    }

    function callZkSync(
        address contractAddr,
        bytes memory data,
        uint256 gasLimit,
        uint256 gasPerPubdataByteLimit
    ) external payable onlyOwner {
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
