import * as hre from "hardhat";

import { web3Provider } from "./utils/utils";
import { BigNumberish, Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// L2
import { Wallet as ZkSyncWallet, Provider, Contract, utils } from "zksync-web3";
import {
  L2ERC20Bridge__factory,
  ZkSyncBridgeExecutor__factory,
} from "../../l2/typechain";
import { L1Executor__factory } from "../typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL || "";
const EMERGENCY_BRAKE_MULTISIG = process.env.EMERGENCY_BRAKE_MULTISIG as string;

const L2_BRIDGE_EXECUTOR_ADDR = process.env.L2_BRIDGE_EXECUTOR_ADDR as string;
const L1_EXECUTOR_ADDR = process.env.L1_EXECUTOR_ADDR as string;

const provider = web3Provider();
const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);

async function main() {
  const program = new Command();

  program.version("0.1.0").name("initialize-bridge-roles");

  program
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--nonce <nonce>")
    .option("--lido-bridge <lido-bridge>")
    .action(async (cmd) => {
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : new Wallet(PRIVATE_KEY, provider);

      const zkWallet = cmd.privateKey
        ? new ZkSyncWallet(cmd.privateKey, zkProvider)
        : new ZkSyncWallet(PRIVATE_KEY, zkProvider);

      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : await provider.getGasPrice();

      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const deployer = new Deployer({
        deployWallet,
        governorAddress: deployWallet.address,
        verbose: true,
      });

      const lidoBridge = cmd.lidoBridge
        ? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
        : deployer.defaultLidoBridge(deployWallet);

      console.log(`Using L1 Bridge: ${lidoBridge.address}`);

      const L1GovernorAgent = deployer.defaultGovernanceAgent(deployWallet);

      console.log("Using L1 Governor Agent: ", L1GovernorAgent.address);

      const l2Bridge = L2ERC20Bridge__factory.connect(
        deployer.addresses.Bridges.LidoL2BridgeProxy,
        zkWallet
      );

      console.log(`Using L2 Bridge: ${l2Bridge.address}`);

      const zkSyncBridgeExecutor = ZkSyncBridgeExecutor__factory.connect(
        L2_BRIDGE_EXECUTOR_ADDR,
        zkWallet
      );

      const zkSync = deployer.zkSyncContract(deployWallet);

      const L1Executor = L1Executor__factory.connect(
        L1_EXECUTOR_ADDR,
        deployWallet
      );

      // get bytecode for roles
      const DEPOSITS_ENABLER_ROLE =
        "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a";
      const DEPOSITS_DISABLER_ROLE =
        "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6";
      const WITHDRAWALS_ENABLER_ROLE =
        "0x9ab8816a3dc0b3849ec1ac00483f6ec815b07eee2fd766a353311c823ad59d0d";
      const WITHDRAWALS_DISABLER_ROLE =
        "0x94a954c0bc99227eddbc0715a62a7e1056ed8784cd719c2303b685683908857c";

      console.log("\n===============L1===============");

      await grantRole(
        lidoBridge,
        DEPOSITS_ENABLER_ROLE,
        "DEPOSITS_ENABLER_ROLE",
        [deployer.addresses.GovernanceL1]
      );

      await grantRole(
        lidoBridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        [deployer.addresses.GovernanceL1, EMERGENCY_BRAKE_MULTISIG]
      );

      await grantRole(
        lidoBridge,
        WITHDRAWALS_ENABLER_ROLE,
        "WITHDRAWALS_ENABLER_ROLE",
        [deployer.addresses.GovernanceL1]
      );

      await grantRole(
        lidoBridge,
        WITHDRAWALS_DISABLER_ROLE,
        "WITHDRAWALS_DISABLER_ROLE",
        [deployer.addresses.GovernanceL1, EMERGENCY_BRAKE_MULTISIG]
      );

      // 2 Step transfer of default admin role to L1 Lido Agent
      const defaultAdminTransferTx = await lidoBridge.beginDefaultAdminTransfer(
        L1GovernorAgent.address
      );

      await defaultAdminTransferTx.wait();

      const data = lidoBridge.interface.encodeFunctionData(
        "acceptDefaultAdminTransfer"
      );

      const acceptDefaultAdminTransferTx = await L1GovernorAgent.execute(
        lidoBridge.address,
        0,
        data,
        {
          gasLimit: 10_000_000,
        }
      );

      await acceptDefaultAdminTransferTx.wait();

      console.log("L1 BRIDGE DEFAULT ADMIN:", await lidoBridge.defaultAdmin());
      console.log(
        "EXPECTED ADMIN:",
        (await lidoBridge.defaultAdmin()) === L1GovernorAgent.address
      );

      console.log("\n===============L2===============");

      await grantRole(
        l2Bridge,
        DEPOSITS_ENABLER_ROLE,
        "DEPOSITS_ENABLER_ROLE",
        [L2_BRIDGE_EXECUTOR_ADDR]
      );

      await grantRole(
        l2Bridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        [L2_BRIDGE_EXECUTOR_ADDR, EMERGENCY_BRAKE_MULTISIG]
      );

      await grantRole(
        l2Bridge,
        WITHDRAWALS_ENABLER_ROLE,
        "WITHDRAWALS_ENABLER_ROLE",
        [L2_BRIDGE_EXECUTOR_ADDR]
      );

      await grantRole(
        l2Bridge,
        WITHDRAWALS_DISABLER_ROLE,
        "WITHDRAWALS_DISABLER_ROLE",
        [L2_BRIDGE_EXECUTOR_ADDR, EMERGENCY_BRAKE_MULTISIG]
      );

      // 2 Step transfer of default admin role to L1 Lido Agent
      const defaultAdminTransferL2Tx = await l2Bridge.beginDefaultAdminTransfer(
        L2_BRIDGE_EXECUTOR_ADDR
      );

      await defaultAdminTransferL2Tx.wait();

      // encode data to be queued by ZkBridgeExecutor on L2
      const dataL2 = zkSyncBridgeExecutor.interface.encodeFunctionData(
        "queue",
        [
          [deployer.addresses.Bridges.LidoL2BridgeProxy],
          [hre.ethers.utils.parseEther("0")],
          ["acceptDefaultAdminTransfer()"],
          [new Uint8Array()],
        ]
      );

      // estimate gas to to bridge encoded from L1 to L2
      const gasLimit = await zkProvider.estimateL1ToL2Execute({
        contractAddress: L2_BRIDGE_EXECUTOR_ADDR,
        calldata: dataL2,
        caller: utils.applyL1ToL2Alias(L1_EXECUTOR_ADDR),
      });

      // estimate cons of L1 to L2 execution
      const baseCost = await zkSync.l2TransactionBaseCost(
        gasPrice,
        gasLimit,
        utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
      );

      // send eth to the agent to cover base cost for L1 to L2 bridging
      const ethTransferResponse = await deployWallet.sendTransaction({
        to: L1GovernorAgent.address,
        value: baseCost,
      });
      await ethTransferResponse.wait();

      /**
       * Encode data which is sent to L1 Executor
       * * This data contains previously encoded queue data
       */
      const encodedDataQueue = L1Executor.interface.encodeFunctionData(
        "callZkSync",
        [
          L2_BRIDGE_EXECUTOR_ADDR,
          dataL2,
          gasLimit,
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
        ]
      );

      /**
       *  Sends Action set from L1 Executor to L2 Bridge Executor
       */
      const executeTx = await L1GovernorAgent.execute(
        L1_EXECUTOR_ADDR,
        baseCost,
        encodedDataQueue,
        { gasPrice, gasLimit: 10_000_000 }
      );

      await executeTx.wait();

      /**
       * Catch ActionsSetQueued Event
       */
      const actionSetQueuedPromise = new Promise((resolve) => {
        zkSyncBridgeExecutor.on("ActionsSetQueued", (actionSetId) => {
          resolve(actionSetId.toString());
          zkSyncBridgeExecutor.removeAllListeners();
        });
      });

      const actionSetId = await actionSetQueuedPromise.then((res) => res);

      console.log("New Action Set Id :", actionSetId);

      const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
        executeTx
      );
      await l2Response2.wait();

      console.log("Action Set Queued on L2");

      const executeAction = await zkSyncBridgeExecutor.execute(
        actionSetId as BigNumberish,
        {
          gasLimit: 10_000_000,
        }
      );

      await executeAction.wait();

      console.log("L2 BRIDGE DEFAULT ADMIN:", await l2Bridge.defaultAdmin());
      console.log(
        "EXPECTED ADMIN:",
        (await l2Bridge.defaultAdmin()) === L2_BRIDGE_EXECUTOR_ADDR
      );
    });

  await program.parseAsync(process.argv);
}

/**
 * grantRole
 */
async function grantRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  targets: string[]
) {
  for (const target of targets) {
    const hasL2ExecutorDepositDisablerRoleL2 = await contract.hasRole(
      roleBytecode,
      target
    );

    if (!hasL2ExecutorDepositDisablerRoleL2) {
      const tx = await contract.grantRole(roleBytecode, target, {
        gasLimit: 10_000_000,
      });
      await tx.wait();

      const isRoleGranted = await contract.hasRole(roleBytecode, target);

      if (!isRoleGranted) {
        console.warn(`Error granting ${roleName} to ${target}`);
        return;
      }
    }
    console.log(`${roleName}:${target}`);
  }
}

/**
 * revokeRole
 */
async function revokeRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  target: string
) {
  const hasRole = await contract.hasRole(roleBytecode, target);

  if (hasRole) {
    const tx = await contract.revokeRole(roleBytecode, target, {
      gasLimit: 10_000_000,
    });
    await tx.wait();

    const hadRole = await contract.hasRole(roleBytecode, target);
    if (!hadRole) {
      console.log(`Revoked ${roleName}: ${target}`);
    }
  }
  console.log(`${target} doesn't possess ${roleName}`);
}

main().catch((error) => {
  throw error;
});
