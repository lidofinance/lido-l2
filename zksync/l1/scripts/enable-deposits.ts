import * as hre from "hardhat";
import { web3Provider } from "./utils/utils";
import { BigNumberish, Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// typechain
import { L1ERC20Bridge__factory, L1Executor__factory } from "../typechain";

// L2
import { Wallet as ZkSyncWallet, Provider, utils } from "zksync-web3";
import {
  ZkSyncBridgeExecutor__factory,
  L2ERC20Bridge__factory,
} from "../../l2/typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;

const L1_EXECUTOR_ADDR = process.env.L1_EXECUTOR_ADDR as string;
const L2_BRIDGE_EXECUTOR_ADDR = process.env.L2_BRIDGE_EXECUTOR_ADDR as string;

const provider = web3Provider();
const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);

async function main() {
  const program = new Command();

  program.version("0.1.0").name("enable-bridging-deposits");

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

      const L1GovernorAgent = deployer.defaultGovernanceAgent(deployWallet);
      console.log("L1 Governor Agent address:", L1GovernorAgent.address);

      const zkSync = deployer.zkSyncContract(deployWallet);

      const L1Executor = L1Executor__factory.connect(
        L1_EXECUTOR_ADDR,
        deployWallet
      );

      const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;

      const IL1ERC20Bridge = new hre.ethers.utils.Interface(L1ERC20BridgeAbi);

      const l2Bridge = L2ERC20Bridge__factory.connect(
        deployer.addresses.Bridges.LidoL2BridgeProxy,
        zkWallet
      );

      const zkSyncBridgeExecutor = ZkSyncBridgeExecutor__factory.connect(
        L2_BRIDGE_EXECUTOR_ADDR,
        zkWallet
      );

      const isDepositEnabledOnL1 = await lidoBridge.isDepositsEnabled();
      const isDepositEnabledOnL2 = await l2Bridge.isDepositsEnabled();

      if (isDepositEnabledOnL1 && isDepositEnabledOnL2) {
        console.log("\n================================");
        console.log("\nDeposits on L1 and L2 bridges are already enabled!");
        console.log("\n================================");
        return;
      }

      console.log("\n===============L1===============");

      if (!isDepositEnabledOnL1) {
        const data = IL1ERC20Bridge.encodeFunctionData("enableDeposits", []);
        const enableDepositsTx = await L1GovernorAgent.execute(
          lidoBridge.address,
          0,
          data,
          {
            gasLimit: 10_000_000,
          }
        );

        await enableDepositsTx.wait();
      }

      console.log(
        "\nDEPOSITS ENABLED ON L1 BRIDGE:",
        await lidoBridge.isDepositsEnabled()
      );

      console.log("\n===============L2===============");

      // encode data to be queued by ZkBridgeExecutor on L2
      const data = zkSyncBridgeExecutor.interface.encodeFunctionData("queue", [
        [deployer.addresses.Bridges.LidoL2BridgeProxy],
        [hre.ethers.utils.parseEther("0")],
        ["enableDeposits()"],
        [new Uint8Array()],
      ]);

      // estimate gas to to bridge encoded from L1 to L2
      const gasLimit = await zkProvider.estimateL1ToL2Execute({
        contractAddress: L2_BRIDGE_EXECUTOR_ADDR,
        calldata: data,
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

      /**
       * Execute Action Set
       */
      if (!isDepositEnabledOnL2) {
        const executeAction = await zkSyncBridgeExecutor.execute(
          actionSetId as BigNumberish,
          {
            gasLimit: 10_000_000,
          }
        );

        await executeAction.wait();
      }

      console.log(
        "\nDEPOSITS ENABLED ON L2 BRIDGE:",
        await l2Bridge.isDepositsEnabled()
      );
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  throw error;
});
