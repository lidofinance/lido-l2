// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

// This file is a workaround for Hardhat's artifacts. Hardhat creates artifacts only for declared contracts.
// So here we import those contracts that are needed only in offchain scripts.
import "../../common/proxy/OssifiableProxy.sol";