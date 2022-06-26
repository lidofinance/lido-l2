// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.4.21;

interface IOutbox {
    function l2ToL1Sender() external view returns (address);
}
