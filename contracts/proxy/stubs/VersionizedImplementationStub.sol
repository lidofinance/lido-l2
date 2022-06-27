// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

contract InitializableImplementationStub {
    uint8 public version;

    function initialize(uint8 version_) external {
        version = version_;
        emit Initialized(version);
    }

    fallback() external {
        emit FallbackIsFired();
    }

    event Initialized(uint256 version);
    event FallbackIsFired();
}
