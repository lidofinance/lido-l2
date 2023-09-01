// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

import {L2BridgeExecutor} from "./L2BridgeExecutor.sol";
import {IL2BridgeExecutor2Step} from "./interfaces/IL2BridgeExecutor2Step.sol";

/**
 * @title L2BridgeExecutor2Step
 * @notice Implements the two step executor update (similar to OpenZeppelin Ownable2Step.sol implementation)
 */
abstract contract L2BridgeExecutor2Step is L2BridgeExecutor, IL2BridgeExecutor2Step {
    address internal _pendingEthereumGovernanceExecutor;

    /**
     * @param ethereumGovernanceExecutor The address of the EthereumGovernanceExecutor which can be EOA or an alias of a contract on L1
     * @param delay The delay before which an actions set can be executed
     * @param gracePeriod The time period after a delay during which an actions set can be executed
     * @param minimumDelay The minimum bound a delay can be set to
     * @param maximumDelay The maximum bound a delay can be set to
     * @param guardian The address of the guardian, which can cancel queued proposals (can be zero)
     */
    constructor(
        address ethereumGovernanceExecutor,
        uint256 delay,
        uint256 gracePeriod,
        uint256 minimumDelay,
        uint256 maximumDelay,
        address guardian
    )
        L2BridgeExecutor(
            ethereumGovernanceExecutor,
            delay,
            gracePeriod,
            minimumDelay,
            maximumDelay,
            guardian
        )
    {}

    /// @inheritdoc IL2BridgeExecutor2Step
    function updateEthereumGovernanceExecutor(
        address ethereumGovernanceExecutor
    ) external override onlyThis {
        require(
            ethereumGovernanceExecutor != address(0),
            "Ethereum Governor address can't be zero"
        );
        _pendingEthereumGovernanceExecutor = ethereumGovernanceExecutor;
        emit EthereumGovernanceExecutorUpdateStarted(
            _ethereumGovernanceExecutor,
            ethereumGovernanceExecutor
        );
    }

    /// @inheritdoc IL2BridgeExecutor2Step
    function acceptEthereumGovernanceExecutor() external {
        address sender = msg.sender;
        if (sender != _pendingEthereumGovernanceExecutor) {
            revert ExecutorUnauthorizedAccount(sender);
        }
        _ethereumGovernanceExecutor = sender;
        emit EthereumGovernanceExecutorUpdateAccepted(
            _ethereumGovernanceExecutor,
            sender
        );
    }

    /// @inheritdoc IL2BridgeExecutor2Step
    function getPendingEthereumGovernanceExecutor() external view returns (address) {
        return _pendingEthereumGovernanceExecutor;
    }
}
