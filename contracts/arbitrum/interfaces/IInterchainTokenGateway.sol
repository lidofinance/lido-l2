// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.4.21;

interface IInterchainTokenGateway {
    function finalizeInboundTransfer(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external;

    function calculateL2TokenAddress(address l1Token)
        external
        view
        returns (address);

    function counterpartGateway() external view returns (address);

    function getOutboundCalldata(
        address l1Token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bytes memory);
}
