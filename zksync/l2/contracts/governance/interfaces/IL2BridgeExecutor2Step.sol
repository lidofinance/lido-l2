// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

import {IL2BridgeExecutor} from "./IL2BridgeExecutor.sol";

/**
 * @title IL2BridgeExecutor2Step
 * @notice Defines the basic interface for the L2BridgeExecutor2Step abstract contract
 */
interface IL2BridgeExecutor2Step is IL2BridgeExecutor {
    error ExecutorUnauthorizedAccount(address account);

    /**
     * @dev Emitted when the Ethereum Governance Executor updated is started
     * @param oldEthereumGovernanceExecutor The address of the old EthereumGovernanceExecutor
     * @param newEthereumGovernanceExecutor The address of the new EthereumGovernanceExecutor
     **/
    event EthereumGovernanceExecutorUpdateStarted(
        address oldEthereumGovernanceExecutor,
        address newEthereumGovernanceExecutor
    );

    /**
     * @dev Emitted when the Ethereum Governance Executor update is accepted
     * @param oldEthereumGovernanceExecutor The address of the old EthereumGovernanceExecutor
     * @param newEthereumGovernanceExecutor The address of the new EthereumGovernanceExecutor
     **/
    event EthereumGovernanceExecutorUpdateAccepted(
        address oldEthereumGovernanceExecutor,
        address newEthereumGovernanceExecutor
    );

    /**
     * @notice Suggest the address update of the Ethereum Governance Executor
     * @param ethereumGovernanceExecutor The suggested address of the new EthereumGovernanceExecutor which can be EOA or an alias of a contract on L1
     **/
    function updateEthereumGovernanceExecutor(
        address ethereumGovernanceExecutor
    ) external;

    /**
     * @notice Accepts the Ethereum Governance Executor role
     **/
    function acceptEthereumGovernanceExecutor() external;

    /**
     * @notice Returns the address of the pending Ethereum Governance Executor
     * @return The address of the pending EthereumGovernanceExecutor which can be EOA or an alias of a contract on L1
     **/
    function getPendingEthereumGovernanceExecutor() external view returns (address);
}
