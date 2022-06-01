// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

library L1OutboundDataParser {
    function decode(address router, bytes memory data)
        internal
        view
        returns (address, uint256)
    {
        if (msg.sender != router) {
            return (msg.sender, _parseSubmissionCostData(data));
        }
        (address from, bytes memory extraData) = abi.decode(
            data,
            (address, bytes)
        );
        return (from, _parseSubmissionCostData(extraData));
    }

    function _parseSubmissionCostData(bytes memory data)
        private
        pure
        returns (uint256 maxSubmissionCost)
    {
        bytes memory extraData;
        (maxSubmissionCost, extraData) = abi.decode(data, (uint256, bytes));
        if (extraData.length != 0) {
            revert ExtraDataNotEmpty();
        }
    }

    error ExtraDataNotEmpty();
}
