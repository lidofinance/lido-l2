// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IExecutorBase} from "./interfaces/IExecutorBase.sol";

/**
 * @title BridgeExecutorBase
 * @notice Aave abstract contract that implements basic executor functionality
 * @dev It does not implement an external `queue` function. This should instead be done in the inheriting
 * contract with proper access control
 */
abstract contract BridgeExecutorBase is Initializable, IExecutorBase {
    // Minimum allowed grace period, which reduces the risk of having an actions set expire due to network congestion
    uint256 constant MINIMUM_GRACE_PERIOD = 10 minutes;

    // Maximum allowed delay, preventing extremely high values that will make queuing excessively long
    uint256 constant MAXIMUM_DELAY = 2 weeks;

    // Time between queuing and execution
    uint256 private _delay;
    // Time after the execution time during which the actions set can be executed
    uint256 private _gracePeriod;
    // Minimum allowed delay
    uint256 private _minimumDelay;
    // Maximum allowed delay
    uint256 private _maximumDelay;
    // Address with the ability of canceling actions sets
    address private _guardian;

    // Number of actions sets
    uint256 private _actionsSetCounter;
    // Map of registered actions sets (id => ActionsSet)
    mapping(uint256 => ActionsSet) private _actionsSets;
    // Map of queued actions (actionHash => isQueued)
    mapping(bytes32 => bool) private _queuedActions;

    /**
     * @dev Only guardian can call functions marked by this modifier.
     **/
    modifier onlyGuardian() {
        if (msg.sender != _guardian) revert NotGuardian();
        _;
    }

    /**
     * @dev Only this contract can call functions marked by this modifier.
     **/
    modifier onlyThis() {
        if (msg.sender != address(this)) revert OnlyCallableByThis();
        _;
    }

    /**
     * @param delay The delay before which an actions set can be executed
     * @param gracePeriod The time period after a delay during which an actions set can be executed
     * @param minimumDelay The minimum bound a delay can be set to
     * @param maximumDelay The maximum bound a delay can be set to
     * @param guardian The address of the guardian, which can cancel queued proposals (can be zero)
     */
    function __BridgeExecutorBase_init(
        uint256 delay,
        uint256 gracePeriod,
        uint256 minimumDelay,
        uint256 maximumDelay,
        address guardian
    ) internal onlyInitializing {
        __BridgeExecutorBase_init_unchained(
            delay,
            gracePeriod,
            minimumDelay,
            maximumDelay,
            guardian
        );
    }

    function __BridgeExecutorBase_init_unchained(
        uint256 delay,
        uint256 gracePeriod,
        uint256 minimumDelay,
        uint256 maximumDelay,
        address guardian
    ) internal onlyInitializing {
        if (
            gracePeriod < MINIMUM_GRACE_PERIOD ||
            maximumDelay > MAXIMUM_DELAY ||
            minimumDelay >= maximumDelay ||
            delay < minimumDelay ||
            delay > maximumDelay
        ) revert InvalidInitParams();

        _updateDelay(delay);
        _updateGracePeriod(gracePeriod);
        _updateMinimumDelay(minimumDelay);
        _updateMaximumDelay(maximumDelay);
        _updateGuardian(guardian);
    }

    /// @inheritdoc IExecutorBase
    function execute(uint256 actionsSetId) external payable override {
        if (getCurrentState(actionsSetId) != ActionsSetState.Queued)
            revert OnlyQueuedActions();

        ActionsSet storage actionsSet = _actionsSets[actionsSetId];
        if (block.timestamp < actionsSet.executionTime)
            revert TimelockNotFinished();

        actionsSet.executed = true;
        uint256 actionCount = actionsSet.targets.length;

        bytes[] memory returnedData = new bytes[](actionCount);
        for (uint256 i = 0; i < actionCount; ) {
            returnedData[i] = _executeTransaction(
                actionsSet.targets[i],
                actionsSet.values[i],
                actionsSet.signatures[i],
                actionsSet.calldatas[i],
                actionsSet.executionTime
            );
            unchecked {
                ++i;
            }
        }

        emit ActionsSetExecuted(actionsSetId, msg.sender, returnedData);
    }

    /// @inheritdoc IExecutorBase
    /// @dev Guardian is a trusted party and may cancel proposals which update the address of the guardian
    function cancel(uint256 actionsSetId) external override onlyGuardian {
        if (getCurrentState(actionsSetId) != ActionsSetState.Queued)
            revert OnlyQueuedActions();

        ActionsSet storage actionsSet = _actionsSets[actionsSetId];
        actionsSet.canceled = true;

        uint256 targetsLength = actionsSet.targets.length;
        for (uint256 i = 0; i < targetsLength; ) {
            _cancelTransaction(
                actionsSet.targets[i],
                actionsSet.values[i],
                actionsSet.signatures[i],
                actionsSet.calldatas[i],
                actionsSet.executionTime
            );
            unchecked {
                ++i;
            }
        }

        emit ActionsSetCanceled(actionsSetId);
    }

    /// @inheritdoc IExecutorBase
    function updateGuardian(address guardian) external override onlyThis {
        _updateGuardian(guardian);
    }

    /// @inheritdoc IExecutorBase
    function updateDelay(uint256 delay) external override onlyThis {
        _validateDelay(delay);
        _updateDelay(delay);
    }

    /// @inheritdoc IExecutorBase
    function updateGracePeriod(uint256 gracePeriod) external override onlyThis {
        if (gracePeriod < MINIMUM_GRACE_PERIOD) revert GracePeriodTooShort();
        _updateGracePeriod(gracePeriod);
    }

    /// @inheritdoc IExecutorBase
    function updateMinimumDelay(
        uint256 minimumDelay
    ) external override onlyThis {
        if (minimumDelay >= _maximumDelay) revert MinimumDelayTooLong();
        _updateMinimumDelay(minimumDelay);
        _validateDelay(_delay);
    }

    /// @inheritdoc IExecutorBase
    function updateMaximumDelay(
        uint256 maximumDelay
    ) external override onlyThis {
        if (maximumDelay > MAXIMUM_DELAY) revert MaximumDelayTooLong();
        if (maximumDelay <= _minimumDelay) revert MaximumDelayTooShort();
        _updateMaximumDelay(maximumDelay);
        _validateDelay(_delay);
    }

    /// @inheritdoc IExecutorBase
    function receiveFunds() external payable override {}

    /// @inheritdoc IExecutorBase
    function getDelay() external view override returns (uint256) {
        return _delay;
    }

    /// @inheritdoc IExecutorBase
    function getGracePeriod() external view override returns (uint256) {
        return _gracePeriod;
    }

    /// @inheritdoc IExecutorBase
    function getMinimumDelay() external view override returns (uint256) {
        return _minimumDelay;
    }

    /// @inheritdoc IExecutorBase
    function getMaximumDelay() external view override returns (uint256) {
        return _maximumDelay;
    }

    /// @inheritdoc IExecutorBase
    function getGuardian() external view override returns (address) {
        return _guardian;
    }

    /// @inheritdoc IExecutorBase
    function getActionsSetCount() external view override returns (uint256) {
        return _actionsSetCounter;
    }

    /// @inheritdoc IExecutorBase
    function getActionsSetById(
        uint256 actionsSetId
    ) external view override returns (ActionsSet memory) {
        return _actionsSets[actionsSetId];
    }

    /// @inheritdoc IExecutorBase
    function getCurrentState(
        uint256 actionsSetId
    ) public view override returns (ActionsSetState) {
        if (_actionsSetCounter <= actionsSetId) revert InvalidActionsSetId();
        ActionsSet storage actionsSet = _actionsSets[actionsSetId];
        if (actionsSet.canceled) {
            return ActionsSetState.Canceled;
        } else if (actionsSet.executed) {
            return ActionsSetState.Executed;
        } else if (block.timestamp > actionsSet.expireTime) {
            return ActionsSetState.Expired;
        } else {
            return ActionsSetState.Queued;
        }
    }

    /// @inheritdoc IExecutorBase
    function isActionQueued(
        bytes32 actionHash
    ) public view override returns (bool) {
        return _queuedActions[actionHash];
    }

    function _updateGuardian(address guardian) internal {
        emit GuardianUpdate(_guardian, guardian);
        _guardian = guardian;
    }

    function _updateDelay(uint256 delay) internal {
        emit DelayUpdate(_delay, delay);
        _delay = delay;
    }

    function _updateGracePeriod(uint256 gracePeriod) internal {
        emit GracePeriodUpdate(_gracePeriod, gracePeriod);
        _gracePeriod = gracePeriod;
    }

    function _updateMinimumDelay(uint256 minimumDelay) internal {
        emit MinimumDelayUpdate(_minimumDelay, minimumDelay);
        _minimumDelay = minimumDelay;
    }

    function _updateMaximumDelay(uint256 maximumDelay) internal {
        emit MaximumDelayUpdate(_maximumDelay, maximumDelay);
        _maximumDelay = maximumDelay;
    }

    /**
     * @notice Queue an ActionsSet
     * @dev If a signature is empty, calldata is used for the execution, calldata is appended to signature otherwise
     * @param targets Array of targets to be called by the actions set
     * @param values Array of values to pass in each call by the actions set
     * @param signatures Array of function signatures to encode in each call (can be empty)
     * @param calldatas Array of calldata to pass in each call (can be empty)
     **/
    function _queue(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas
    ) internal {
        if (targets.length == 0) revert EmptyTargets();
        if (targets.length > 3) revert TooManyTargets();
        uint256 targetsLength = targets.length;
        if (
            targetsLength != values.length ||
            targetsLength != signatures.length ||
            targetsLength != calldatas.length
        ) revert InconsistentParamsLength();

        uint256 actionsSetId = _actionsSetCounter;
        uint256 executionTime = block.timestamp + _delay;
        uint256 expireTime = executionTime + _gracePeriod;

        unchecked {
            ++_actionsSetCounter;
        }

        for (uint256 i = 0; i < targetsLength; ) {
            bytes32 actionHash = keccak256(
                abi.encode(
                    targets[i],
                    values[i],
                    signatures[i],
                    calldatas[i],
                    executionTime
                )
            );
            if (isActionQueued(actionHash)) revert DuplicateAction();
            _queuedActions[actionHash] = true;
            unchecked {
                ++i;
            }
        }

        ActionsSet storage actionsSet = _actionsSets[actionsSetId];
        actionsSet.targets = targets;
        actionsSet.values = values;
        actionsSet.signatures = signatures;
        actionsSet.calldatas = calldatas;
        actionsSet.executionTime = executionTime;
        actionsSet.expireTime = expireTime;

        emit ActionsSetQueued(
            actionsSetId,
            targets,
            values,
            signatures,
            calldatas,
            executionTime
        );
    }

    function _executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executionTime
    ) internal returns (bytes memory) {
        if (address(this).balance < value) revert InsufficientBalance();

        bytes32 actionHash = keccak256(
            abi.encode(target, value, signature, data, executionTime)
        );
        _queuedActions[actionHash] = false;

        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        bool success;
        bytes memory resultData;

        // solium-disable-next-line security/no-call-value
        (success, resultData) = target.call{value: value}(callData);

        return _verifyCallResult(success, resultData);
    }

    function _cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executionTime
    ) internal {
        bytes32 actionHash = keccak256(
            abi.encode(target, value, signature, data, executionTime)
        );
        _queuedActions[actionHash] = false;
    }

    function _validateDelay(uint256 delay) internal view {
        if (delay < _minimumDelay) revert DelayShorterThanMin();
        if (delay > _maximumDelay) revert DelayLongerThanMax();
    }

    function _verifyCallResult(
        bool success,
        bytes memory returnData
    ) private pure returns (bytes memory) {
        if (success) {
            return returnData;
        } else {
            // Look for revert reason and bubble it up if present
            if (returnData.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert FailedActionExecution();
            }
        }
    }
}
