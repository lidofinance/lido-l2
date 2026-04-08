// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import {L1ERC20Bridge} from "../../zksync/l1/contracts/L1ERC20Bridge.sol";
import {IL1ERC20Bridge} from "../../zksync/l1/contracts/interfaces/IL1ERC20Bridge.sol";
import {ZkSyncStub} from "../../zksync/l1/contracts/stubs/ZkSyncStub.sol";
import {MaliciousToken} from "../../zksync/l1/contracts/stubs/MaliciousToken.sol";
import {OssifiableProxy} from "../../zksync/common/proxy/OssifiableProxy.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 with public mint for testing
contract TestERC20 is ERC20 {
    constructor() ERC20("Test wstETH", "wstETH") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ClaimFailedDepositGriefTest is Test {
    L1ERC20Bridge bridge;
    ZkSyncStub zkSync;
    TestERC20 l1Token;
    MaliciousToken maliciousToken;

    address deployer = address(this);
    address governor = makeAddr("governor");
    address depositor = makeAddr("depositor");
    address griefer = makeAddr("griefer");
    address l2Token = makeAddr("l2Token");
    address l2Receiver = makeAddr("l2Receiver");

    bytes32 canonicalTxHash = keccak256("failed-l2-tx");

    function setUp() public {
        zkSync = new ZkSyncStub();
        l1Token = new TestERC20();
        maliciousToken = new MaliciousToken();

        L1ERC20Bridge impl = new L1ERC20Bridge();
        OssifiableProxy proxy = new OssifiableProxy(
            address(impl),
            governor,
            ""
        );
        bridge = L1ERC20Bridge(address(proxy));

        // Factory deps: 32 bytes = 1 word (odd), required by L2ContractHelper.hashL2Bytecode
        bytes memory dummyBytecode = new bytes(32);
        bytes[] memory factoryDeps = new bytes[](2);
        factoryDeps[0] = dummyBytecode;
        factoryDeps[1] = dummyBytecode;

        bridge.initialize(
            factoryDeps,
            IL1ERC20Bridge.InitializeAddressesParams({
                _l1Token: address(l1Token),
                _l2Token: l2Token,
                _governor: governor,
                _admin: deployer,
                _zkSync: address(zkSync)
            }),
            0,
            0
        );

        zkSync.setCanonicalTxHash(canonicalTxHash);

        l1Token.mint(depositor, 10 ether);
        vm.startPrank(depositor);
        l1Token.approve(address(bridge), 10 ether);
        bridge.deposit(l2Receiver, address(l1Token), 10 ether, 1_000_000, 800, depositor);
        vm.stopPrank();

        assertEq(bridge.depositAmount(depositor, canonicalTxHash), 10 ether);
        assertEq(l1Token.balanceOf(address(bridge)), 10 ether);
    }

    /// @notice Demonstrates that the fix blocks the griefing attack.
    ///         A griefer tries to call claimFailedDeposit with a fake l1Token.
    ///         With the fix (onlySupportedL1Token), this reverts.
    ///         Without the fix, this would succeed, deleting the depositor's
    ///         depositAmount and preventing them from ever reclaiming funds.
    function test_griefingAttackIsBlocked() public {
        bytes32[] memory merkleProof = new bytes32[](2);
        merkleProof[0] = bytes32(uint256(1));
        merkleProof[1] = bytes32(uint256(2));

        // Griefer passes a fake token that always returns true on transfer.
        // Without onlySupportedL1Token, this would delete depositAmount and
        // permanently lock the depositor out of their funds.
        vm.prank(griefer);
        vm.expectRevert(abi.encodeWithSignature("ErrorUnsupportedL1Token()"));
        bridge.claimFailedDeposit(
            depositor, address(maliciousToken), canonicalTxHash, 1, 1, 1, merkleProof
        );

        assertEq(
            bridge.depositAmount(depositor, canonicalTxHash),
            10 ether,
            "depositAmount must remain intact after griefing attempt"
        );

        // Legitimate claim with the correct l1Token still works
        bridge.claimFailedDeposit(
            depositor, address(l1Token), canonicalTxHash, 1, 1, 1, merkleProof
        );

        assertEq(bridge.depositAmount(depositor, canonicalTxHash), 0);
        assertEq(l1Token.balanceOf(depositor), 10 ether);
    }
}
