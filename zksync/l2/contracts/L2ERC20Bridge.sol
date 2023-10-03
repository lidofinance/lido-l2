// SPDX-FileCopyrightText: 2023 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

import {IL1ERC20Bridge} from "./interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "./interfaces/IL2ERC20Bridge.sol";

import {IERC20BridgedUpgradeable} from "./interfaces/IERC20BridgedUpgradeable.sol";

import {BridgingManager} from "../../common/BridgingManager.sol";
import {BridgeableTokensUpgradable} from "../../common/BridgeableTokensUpgradable.sol";
import {L2CrossDomainEnabled} from "./L2CrossDomainEnabled.sol";

/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. Mints tokens during deposits and burns tokens during withdrawals.
///     Additionally, adds the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2ERC20Bridge is
    IL2ERC20Bridge,
    BridgingManager,
    BridgeableTokensUpgradable,
    L2CrossDomainEnabled
{
    /// @inheritdoc IL2ERC20Bridge
    address public override l1Bridge;

    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Disable the initialization to prevent Parity hack.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with parameters needed for its functionality.
    /// @param _l1TokenBridge Address of the corresponding L1 bridge
    /// @param _l1Token Address of the bridged token in the L1 chain
    /// @param _l2Token Address of the token minted on the L2 chain when token bridged
    /// @param _admin Address of the account to grant the DEFAULT_ADMIN_ROLE
    /// @dev The function can only be called once during contract deployment due to the 'initializer' modifier.
    function initialize(
        address _l1TokenBridge,
        address _l1Token,
        address _l2Token,
        address _admin
    ) external initializer onlyNonZeroAccount(_l1TokenBridge) {
        require(_l1Token != address(0), "L1 token address cannot be zero");
        require(_l2Token != address(0), "L2 token address cannot be zero");

        __BridgeableTokens_init(_l1Token, _l2Token);
        __BridgingManager_init(_admin);

        l1Bridge = _l1TokenBridge;
    }

    /// @inheritdoc IL2ERC20Bridge
    function finalizeDeposit(
        address _l1Sender,
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        bytes calldata // _data
    )
        external
        payable
        override
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
        onlyFromCrossDomainAccount(l1Bridge)
    {
        require(msg.value == 0, "Value should be 0 for ERC20 bridge");

        IERC20BridgedUpgradeable(l2Token).bridgeMint(_l2Receiver, _amount);

        emit FinalizeDeposit(_l1Sender, _l2Receiver, l2Token, _amount);
    }

    /// @inheritdoc IL2ERC20Bridge
    function withdraw(
        address _l1Receiver,
        address _l2Token,
        uint256 _amount
    ) external override whenWithdrawalsEnabled onlySupportedL2Token(_l2Token) {
        IERC20BridgedUpgradeable(l2Token).bridgeBurn(msg.sender, _amount);

        bytes memory message = _getL1WithdrawMessage(
            _l1Receiver,
            l1Token,
            _amount
        );
        sendCrossDomainMessage(message);

        emit WithdrawalInitiated(msg.sender, _l1Receiver, _l2Token, _amount);
    }

    /// @notice Encode the message for l2ToL1log sent with withdraw initialization
    /// @param _to Address that will receive tokens on L1 after finalizeWithdrawal
    /// @param _l1Token The address of the token that was locked on the L1
    /// @param _amount The total amount of tokens to be withdrawn
    function _getL1WithdrawMessage(
        address _to,
        address _l1Token,
        uint256 _amount
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                IL1ERC20Bridge.finalizeWithdrawal.selector,
                _to,
                _l1Token,
                _amount
            );
    }

    /// @inheritdoc IL2ERC20Bridge
    function l1TokenAddress(
        address _l2Token
    ) public view override returns (address l1TokenAddr) {
        l1TokenAddr = _l2Token == l2Token ? l1Token : address(0);
    }

    /// @inheritdoc IL2ERC20Bridge
    function l2TokenAddress(
        address _l1Token
    ) public view override returns (address l2TokenAddr) {
        l2TokenAddr = _l1Token == l1Token ? l2Token : address(0);
    }
}
