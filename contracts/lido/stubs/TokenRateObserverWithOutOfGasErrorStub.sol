// SPDX-FileCopyrightText: 2024 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ITokenRateObserver} from "../interfaces/ITokenRateObserver.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract TokenRateObserverWithOutOfGasErrorStub is ERC165, ITokenRateObserver {

    error SomeError();

    mapping (uint256 => uint256) data;

    function handleTokenRebased() external {
        for (uint256 i = 0; i < 1000000000000; ++i) {
            data[i] = i;
        }

        //revert SomeError();
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return (
            _interfaceId == type(ITokenRateObserver).interfaceId
            || super.supportsInterface(_interfaceId)
        );
    }
}
