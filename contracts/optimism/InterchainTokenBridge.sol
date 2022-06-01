// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {CrossDomainEnabled} from "./CrossDomainEnabled.sol";
import {BridgingManager} from "../BridgingManager.sol";

contract InterchainTokenBridge is BridgingManager, CrossDomainEnabled {
    address public immutable l1Token;
    address public immutable l2Token;

    constructor(
        address messenger_,
        address l1Token_,
        address l2Token_
    ) CrossDomainEnabled(messenger_) {
        l1Token = l1Token_;
        l2Token = l2Token_;
    }

    modifier onlySupportedL1Token(address l1Token_) {
        if (l1Token_ != l1Token) {
            revert ErrorWrongL1Token();
        }
        _;
    }

    modifier onlySupportedL2Token(address l2Token_) {
        if (l2Token_ != l2Token) {
            revert ErrorWrongL2Token();
        }
        _;
    }

    error ErrorWrongL1Token();
    error ErrorWrongL2Token();
}
