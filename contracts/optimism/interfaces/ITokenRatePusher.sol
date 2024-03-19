// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/// @author kovalgek
/// @notice An interface for entity that pushes rate.
interface ITokenRatePusher {
    /// @notice Pushes token rate to L2 by depositing zero tokens.
    /// @param l2Gas_ Gas limit required to complete the deposit on L2.
    function pushTokenRate(uint32 l2Gas_) external;
}