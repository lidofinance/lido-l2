// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.10;

import {IL2BridgeExecutor} from './interfaces/IL2BridgeExecutor.sol';
import {BridgeExecutorBaseUpgradable} from './BridgeExecutorBaseUpgradable.sol';

/**
 * @title L2BridgeExecutor
 * @notice Upgadeable variant of Aave abstract contract that implements bridge executor functionality for L2
 * @dev It does not implement the `onlyEthereumGovernanceExecutor` modifier. This should instead be done in the inheriting
 * contract with proper configuration and adjustments depending on the L2
 */
abstract contract L2BridgeExecutorUpgradable is BridgeExecutorBaseUpgradable, IL2BridgeExecutor {
  // Address of the Ethereum Governance Executor, which should be able to queue actions sets
  address internal _ethereumGovernanceExecutor;

  /**
   * @dev Only the Ethereum Governance Executor should be able to call functions marked by this modifier.
   **/
  modifier onlyEthereumGovernanceExecutor() virtual;

  /**
   * @param ethereumGovernanceExecutor The address of the EthereumGovernanceExecutor
   * @param delay The delay before which an actions set can be executed
   * @param gracePeriod The time period after a delay during which an actions set can be executed
   * @param minimumDelay The minimum bound a delay can be set to
   * @param maximumDelay The maximum bound a delay can be set to
   * @param guardian The address of the guardian, which can cancel queued proposals (can be zero)
   */
  function __L2BridgeExecutor_init(
    address ethereumGovernanceExecutor,
    uint256 delay,
    uint256 gracePeriod,
    uint256 minimumDelay,
    uint256 maximumDelay,
    address guardian
  ) internal onlyInitializing {
    __BridgeExecutorBase_init_unchained(delay, gracePeriod, minimumDelay, maximumDelay, guardian);
    __L2BridgeExecutor_init_unchained(ethereumGovernanceExecutor);
  }

  function __L2BridgeExecutor_init_unchained(
    address ethereumGovernanceExecutor
  ) internal onlyInitializing {
    _ethereumGovernanceExecutor = ethereumGovernanceExecutor;
  }

  /// @inheritdoc IL2BridgeExecutor
  function queue(
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    bool[] memory withDelegatecalls
  ) external onlyEthereumGovernanceExecutor {
    _queue(targets, values, signatures, calldatas, withDelegatecalls);
  }

  /// @inheritdoc IL2BridgeExecutor
  function updateEthereumGovernanceExecutor(address ethereumGovernanceExecutor) external onlyThis {
    emit EthereumGovernanceExecutorUpdate(_ethereumGovernanceExecutor, ethereumGovernanceExecutor);
    _ethereumGovernanceExecutor = ethereumGovernanceExecutor;
  }

  /// @inheritdoc IL2BridgeExecutor
  function getEthereumGovernanceExecutor() external view returns (address) {
    return _ethereumGovernanceExecutor;
  }
}
