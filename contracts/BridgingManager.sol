// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.13;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract BridgingManager is AccessControl {
    struct State {
        bool isDepositsEnabled;
        bool isWithdrawalsEnabled;
        bool isInitialized;
    }

    bytes32 public constant DEPOSITS_DISABLER_ROLE =
        keccak256("GatewayManager.DEPOSITS_DISABLER_ROLE");
    bytes32 public constant DEPOSITS_ENABLER_ROLE =
        keccak256("GatewayManager.DEPOSITS_ENABLER_ROLE");
    bytes32 public constant WITHDRAWALS_ENABLER_ROLE =
        keccak256("GatewayManager.WITHDRAWALS_ENABLER_ROLE");
    bytes32 public constant WITHDRAWALS_DISABLER_ROLE =
        keccak256("GatewayManager.WITHDRAWALS_DISABLER_ROLE");

    function initialize(address admin_) external {
        State storage s = _loadState();
        if (s.isInitialized) {
            revert ErrorAlreadyInitialized();
        }
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        s.isInitialized = true;
    }

    function isInitialized() public view returns (bool) {
        return _loadState().isInitialized;
    }

    function isDepositsEnabled() public view returns (bool) {
        return _loadState().isDepositsEnabled;
    }

    function isWithdrawalsEnabled() public view returns (bool) {
        return _loadState().isWithdrawalsEnabled;
    }

    function enableDeposits() external onlyRole(DEPOSITS_ENABLER_ROLE) {
        if (isDepositsEnabled()) {
            revert ErrorDepositsEnabled();
        }
        _loadState().isDepositsEnabled = true;
        emit DepositsEnabled(msg.sender);
    }

    function disableDeposits()
        external
        whenDepositsEnabled
        onlyRole(DEPOSITS_DISABLER_ROLE)
    {
        _loadState().isDepositsEnabled = false;
        emit DepositsDisabled(msg.sender);
    }

    function enableWithdrawals() external onlyRole(WITHDRAWALS_ENABLER_ROLE) {
        if (isWithdrawalsEnabled()) {
            revert ErrorWithdrawalsEnabled();
        }
        _loadState().isWithdrawalsEnabled = true;
        emit WithdrawalsEnabled(msg.sender);
    }

    function disableWithdrawals()
        external
        whenWithdrawalsEnabled
        onlyRole(WITHDRAWALS_DISABLER_ROLE)
    {
        _loadState().isWithdrawalsEnabled = false;
        emit WithdrawalsDisabled(msg.sender);
    }

    modifier whenDepositsEnabled() {
        if (!isDepositsEnabled()) {
            revert ErrorDepositsDisabled();
        }
        _;
    }

    modifier whenWithdrawalsEnabled() {
        if (!isWithdrawalsEnabled()) {
            revert ErrorWithdrawalsDisabled();
        }
        _;
    }

    function _loadState() private pure returns (State storage r) {
        bytes32 slot = keccak256("GatewayManager.state");
        assembly {
            r.slot := slot
        }
    }

    event DepositsEnabled(address indexed enabler);
    event DepositsDisabled(address indexed disabler);

    event WithdrawalsDisabled(address indexed enabler);
    event WithdrawalsEnabled(address indexed disabler);

    error ErrorDepositsEnabled();
    error ErrorDepositsDisabled();

    error ErrorWithdrawalsEnabled();
    error ErrorWithdrawalsDisabled();
    error ErrorAlreadyInitialized();
}
