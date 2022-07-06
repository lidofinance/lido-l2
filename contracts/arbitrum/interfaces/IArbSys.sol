// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @title Precompiled contract that exists in every Arbitrum chain at address(100),
///     0x0000000000000000000000000000000000000064. Exposes a variety of system-level functionality
interface IArbSys {
    /// @notice Send a transaction to L1
    /// @param destination_ Recipient address on L1
    /// @param calldataForL1_ (optional) Calldata for L1 contract call
    /// @return Unique identifier for this L2-to-L1 transaction
    function sendTxToL1(address destination_, bytes calldata calldataForL1_)
        external
        payable
        returns (uint256);
}
