// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

contract AragonAgentMock {
    event Execute(
        address indexed sender,
        address indexed target,
        uint256 ethValue,
        bytes data
    );

    function execute(
        address _target,
        uint256 _ethValue,
        bytes calldata _data
    ) external {
        (bool success, ) = _target.call{value: _ethValue}(_data);

        if (success) {
            emit Execute(msg.sender, _target, _ethValue, _data);
        }

        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize())

            // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
            // if the call returned error data, forward it
            switch success
            case 0 {
                revert(ptr, returndatasize())
            }
            default {
                return(ptr, returndatasize())
            }
        }
    }

    receive() external payable {}
}
