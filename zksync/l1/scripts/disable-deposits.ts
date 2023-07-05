/* eslint-disable prettier/prettier */
import * as hre from "hardhat";
import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// typechain
import { L1ERC20Bridge__factory } from "../typechain/factories/l1/contracts/L1ERC20Bridge__factory";
import { L1Executor__factory } from "../typechain/factories/l1/contracts/governance/L1Executor__factory";

// L2
import { Wallet as ZkSyncWallet, Provider, utils, Contract } from "zksync-web3";
import ZkSyncBridgeExecutorUpgradable from "../../l2/artifacts-zk/l2/contracts/governance/ZkSyncBridgeExecutorUpgradable.sol/ZkSyncBridgeExecutorUpgradable.json";
import L2ERC20Bridge from "../../l2/artifacts-zk/l2/contracts/L2ERC20Bridge.sol/L2ERC20Bridge.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL || "";

const L1_EXECUTOR_ADDR =
  process.env.CONTRACTS_L1_GOVERNANCE_EXECUTOR_ADDR || "";

const L2_BRIDGE_EXECUTOR_ADDR = process.env.L2_BRIDGE_EXECUTOR_ADDR || "";

const provider = web3Provider();
const zkProvider = new Provider(ZK_CLIENT_WEB3_URL, 270);

async function main() {
  const program = new Command();

  program.version("0.1.0").name("disable-bridging-deposits");

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
      console.log("L1 Governor Agent address:", L1GovernorAgent.address);

      const zkSync = deployer.zkSyncContract(deployWallet);

      const L1Executor = L1Executor__factory.connect(
        L1_EXECUTOR_ADDR,
        deployWallet
      );

      const L2Bridge = new Contract(
        deployer.addresses.Bridges.LidoL2BridgeProxy,
        L2ERC20Bridge.abi,
        zkWallet
      );

      const ZkSyncBridgeExecutor = new Contract(
        L2_BRIDGE_EXECUTOR_ADDR,
        ZkSyncBridgeExecutorUpgradable.abi,
        zkWallet
      );
      // Contract Abis and Interfaces
      const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;
      const IL1ERC20Bridge = new hre.ethers.utils.Interface(L1ERC20BridgeAbi);

      const IZkSyncBridgeExecutorUpgradable = new hre.ethers.utils.Interface(
        ZkSyncBridgeExecutorUpgradable.abi
      );

      const isDepositEnabledOnL1 = await lidoBridge.isDepositsEnabled();
      const isDepositEnabledOnL2 = await L2Bridge.isDepositsEnabled();

      if (!isDepositEnabledOnL1 && !isDepositEnabledOnL2) {
        console.log("\n================================");
        console.log("\nDeposits on L1 and L2 bridges are already disabled!");
        console.log("\n================================");
        return;
      }

      console.log("\n===============L1===============");
      if (isDepositEnabledOnL1) {
        const data = IL1ERC20Bridge.encodeFunctionData("disableDeposits", []);
        const disableDepositsTx = await L1GovernorAgent.execute(
          lidoBridge.address,
          0,
          data,
          {
            gasLimit: 10_000_000,
          }
        );

        await disableDepositsTx.wait();
      }

      console.log(
        "\nDEPOSITS DISABLED ON L1 BRIDGE:",
        !(await lidoBridge.isDepositsEnabled())
      );

      console.log("\n===============L2===============");

      // encode data to be queued by ZkBridgeExecutor on L2
      const data = IZkSyncBridgeExecutorUpgradable.encodeFunctionData("queue", [
        [deployer.addresses.Bridges.LidoL2BridgeProxy],
        [hre.ethers.utils.parseEther("0")],
        ["disableDeposits()"],
        [new Uint8Array()],
        [false],
      ]);

      // estimate gas to to bridge encoded from L1 to L2
      const gasLimit = await zkProvider.estimateL1ToL2Execute({
        contractAddress: L2_BRIDGE_EXECUTOR_ADDR,
        calldata: data,
        caller: utils.applyL1ToL2Alias(L1Executor.address),
      });

      // estimate cons of L1 to L2 execution
      const baseCost = await zkSync.l2TransactionBaseCost(
        gasPrice,
        gasLimit,
        utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
      );

      /**
       * Encode data which is sent to L1 Executor
       * * This data contains previously encoded queue data
       */
      const encodedDataQueue = L1Executor.interface.encodeFunctionData(
        "callZkSync",
        [
          zkSync.address,
          L2_BRIDGE_EXECUTOR_ADDR,
          data,
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

      // maybe filtering by block number would be a better idea
      const actionSetQueuedPromise = new Promise((resolve) => {
        ZkSyncBridgeExecutor.on("ActionsSetQueued", (actionSetId) => {
          resolve(actionSetId.toString());
          ZkSyncBridgeExecutor.removeAllListeners();
        });
      });

      const actionSetId = await actionSetQueuedPromise.then((res) => res);
      console.log("New action set id to disable deposits:", actionSetId);

      const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
        executeTx
      );
      await l2Response2.wait();

      /**
       * Execute Action Set
       */

      if (isDepositEnabledOnL2) {
        const executeAction = await ZkSyncBridgeExecutor.execute(actionSetId, {
          gasLimit: 10_000_000,
        });

        await executeAction.wait();
      }

      console.log(
        "\nDEPOSITS DISABLED ON L2 BRIDGE:",
        !(await L2Bridge.isDepositsEnabled())
      );
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  throw error;
});
