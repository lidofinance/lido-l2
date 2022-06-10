// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.9.0;

/* Interface Imports */
import {ICrossDomainMessenger} from "./interfaces/ICrossDomainMessenger.sol";
import "hardhat/console.sol";

/**
 * @title CrossDomainEnabled
 * @dev Helper contract for contracts performing cross-domain communications
 *
 * Compiler used: defined by inheriting contract
 */
contract CrossDomainEnabled {
    /*************
     * Variables *
     *************/

    // Messenger contract used to send and recieve messages from the other domain.
    ICrossDomainMessenger public immutable messenger;

    /***************
     * Constructor *
     ***************/

    /**
     * @param _messenger Address of the CrossDomainMessenger on the current layer.
     */
    constructor(address _messenger) {
        messenger = ICrossDomainMessenger(_messenger);
    }

    /**********************
     * Function Modifiers *
     **********************/

    /**
     * Enforces that the modified function is only callable by a specific cross-domain account.
     * @param _sourceDomainAccount The only account on the originating domain which is
     *  authenticated to call this function.
     */
    modifier onlyFromCrossDomainAccount(address _sourceDomainAccount) {
        if (msg.sender != address(messenger)) {
            revert ErrorUnauthorizedMessenger();
        }
        if (messenger.xDomainMessageSender() != _sourceDomainAccount) {
            revert ErrorWrongCrossDomainSender();
        }

        _;
    }

    /**********************
     * Internal Functions *
     **********************/

    /**q
     * Sends a message to an account on another domain
     * @param _crossDomainTarget The intended recipient on the destination domain
     * @param _message The data to send to the target (usually calldata to a function with
     *  `onlyFromCrossDomainAccount()`)
     * @param _gasLimit The gasLimit for the receipt of the message on the target domain.
     */
    function sendCrossDomainMessage(
        address _crossDomainTarget,
        uint32 _gasLimit,
        bytes memory _message
    ) internal {
        // slither-disable-next-line reentrancy-events, reentrancy-benign
        messenger.sendMessage(_crossDomainTarget, _message, _gasLimit);
    }

    error ErrorUnauthorizedMessenger();
    error ErrorWrongCrossDomainSender();
}
