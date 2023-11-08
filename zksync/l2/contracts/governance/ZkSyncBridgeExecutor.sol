// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.10;

import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l1/contracts/vendor/AddressAliasHelper.sol";
import {L2BridgeExecutor} from "./L2BridgeExecutor.sol";

contract ZkSyncBridgeExecutor is L2BridgeExecutor {
    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Disable the initialization to prevent Parity hack.
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc L2BridgeExecutor
    modifier onlyEthereumGovernanceExecutor() override {
        if (msg.sender != _ethereumGovernanceExecutor)
            revert UnauthorizedEthereumExecutor();
        _;
    }

    /**
     * @param ethereumGovernanceExecutor The address of the EthereumGovernanceExecutor
     * @param delay The delay before which an actions set can be executed
     * @param gracePeriod The time period after a delay during which an actions set can be executed
     * @param minimumDelay The minimum bound a delay can be set to
     * @param maximumDelay The maximum bound a delay can be set to
     * @param guardian The address of the guardian, which can cancel queued proposals (can be zero)
     */
    function __ZkSyncBridgeExecutor_init(
        address ethereumGovernanceExecutor,
        uint256 delay,
        uint256 gracePeriod,
        uint256 minimumDelay,
        uint256 maximumDelay,
        address guardian
    ) public initializer {
        __L2BridgeExecutor_init(
            ethereumGovernanceExecutor,
            delay,
            gracePeriod,
            minimumDelay,
            maximumDelay,
            guardian
        );
    }
}
