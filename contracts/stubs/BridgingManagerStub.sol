// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

import {BridgingManager} from "../BridgingManager.sol";

pragma solidity 0.8.10;

/// @dev For testing purposes.
contract BridgingManagerStub is BridgingManager {
    function initialize(address admin_) external {
        _initializeBridgingManager(admin_);
    }
}
