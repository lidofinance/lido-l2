// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";

/**
 * @dev An ossifiable proxy contract.
 */
contract OssifiableProxy is ERC1967Proxy {
    /**
     * @dev Initializes the upgradeable proxy with the initial implementation and admin.
     */
    constructor(
        address implementation,
        address admin,
        bytes memory data
    ) ERC1967Proxy(implementation, data) {
        _changeAdmin(admin);
    }

    /**
     * @dev Returns the current admin of the proxy.
     */
    function proxy__getAdmin() external view returns (address) {
        return _getAdmin();
    }

    /**
     * @return Returns the current implementation address.
     */
    function proxy__getImplementation() external view returns (address) {
        return _implementation();
    }

    /**
     * @dev Returns whether the implementation is locked forever.
     */
    function proxy__getIsOssified() external view returns (bool) {
        return _getAdmin() == address(0);
    }

    function proxy__ossify() external onlyAdmin whenNotOssified {
        address prevAdmin = _getAdmin();
        StorageSlot.getAddressSlot(_ADMIN_SLOT).value = address(0);
        emit AdminChanged(prevAdmin, address(0));
        emit ProxyOssified();
    }

    /**
     * @dev Changes the admin of the proxy.
     *
     * Emits an {AdminChanged} event.
     */
    function proxy__changeAdmin(address newAdmin)
        external
        onlyAdmin
        whenNotOssified
    {
        _changeAdmin(newAdmin);
    }

    function proxy__upgradeTo(address newImplementation)
        external
        onlyAdmin
        whenNotOssified
    {
        _upgradeTo(newImplementation);
    }

    /**
     * @dev Upgrades the proxy to a new implementation, optionally performing an additional
     * setup call.
     *
     * Can only be called by the proxy admin until the proxy is ossified.
     * Cannot be called after the proxy is ossified.
     *
     * Emits an {Upgraded} event.
     *
     * @param data Data for the setup call. The call is skipped if data is empty.
     */
    function proxy__upgradeToAndCall(
        address newImplementation,
        bytes memory data,
        bool forceCall
    ) external onlyAdmin whenNotOssified {
        _upgradeToAndCall(newImplementation, data, forceCall);
    }

    modifier whenNotOssified() {
        if (_getAdmin() == address(0)) {
            revert ErrorProxyIsOssified();
        }
        _;
    }

    modifier onlyAdmin() {
        address admin = _getAdmin();
        if (admin != address(0) && msg.sender != admin) {
            revert ErrorNotAdmin();
        }
        _;
    }

    error ErrorNotAdmin();
    error ErrorProxyIsOssified();
    event ProxyOssified();
}
