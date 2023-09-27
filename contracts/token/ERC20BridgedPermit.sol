// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {ERC20Bridged} from "./ERC20Bridged.sol";
import {IERC2612} from "@openzeppelin/contracts/interfaces/draft-IERC2612.sol";

/// @author 0xMantle
/// @notice Extends the ERC20 functionality that allows the bridge to mint/burn tokens
contract ERC20BridgedPermit is ERC20Bridged, IERC2612 {

    mapping(address => uint256) public override nonces;

    bytes32 public immutable PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address bridge_)
        ERC20Bridged(name_, symbol_, decimals_, bridge_){}

    function _domainSeparatorV4() internal view returns (bytes32) {
        return _buildDomainSeparator();
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"), 
                keccak256(bytes(name())), 
                keccak256(bytes(version())), 
                block.chainid, 
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() external view virtual returns (bytes32) {
        return _domainSeparatorV4();
    }


    function version() public pure virtual returns (string memory) {
        return "1";
    }

    function permit(address owner, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        public
        virtual
        override
    {
        if (deadline < block.timestamp) {
            revert ErrorExpiredPermit();
        }

        bytes32 hashStruct = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, amount, nonces[owner]++, deadline));

        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), hashStruct));

        address signer = ecrecover(hash, v, r, s);

        if (signer == address(0) || signer != owner) {
            revert ErrorInvalidSignature();
        }

        _approve(owner, spender, amount);
    }

    /// @dev used to consume a nonce so that the user is able to invalidate a signature. Returns the current value and increments.
    function useNonce() external virtual returns (uint256 current) {
        current = nonces[msg.sender];
        nonces[msg.sender]++;
    }

    error ErrorExpiredPermit();
    error ErrorInvalidSignature();
}