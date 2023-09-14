import { web3Provider } from "../utils/utils";
import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "../deploy";

// typechain
import { L1Executor__factory } from "../../typechain";

// L2
import { Wallet as ZkSyncWallet, Provider, utils } from "zksync-web3";
import {
  ProxyAdmin__factory,
  TransparentUpgradeableProxy__factory,
} from "../../../l2/typechain";
import { SYSTEM_CONFIG_CONSTANTS } from "../utils/constants";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;

const L1_EXECUTOR_ADDR = process.env.L1_EXECUTOR_ADDR as string;

const L2_TOKEN_PROXY_ADMIN = "0x502DAd7bF4F63D5ab5E1fc3b5d7D56Fe8f953069";
const CONTRACTS_L2_LIDO_TOKEN_ADDR = process.env
  .CONTRACTS_L2_LIDO_TOKEN_ADDR as string;
const NEW_L2_TOKEN_IMPL = "0x4a2cc36B98debBEb649d802E8B136f37a3705dC8";

const provider = web3Provider();
const zkProvider = new Provider(ZKSYNC_PROVIDER_URL, SYSTEM_CONFIG_CONSTANTS.CHAIND_ID);

async function main() {
  const program = new Command();

  program.version("0.1.0").name("upgrade-wsteth-token");

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

      const L1GovernorAgent = deployer.defaultGovernanceAgent(deployWallet);
      console.log("L1 Governor Agent address:", L1GovernorAgent.address);

      const zkSync = deployer.zkSyncContract(deployWallet);

      const L1Executor = L1Executor__factory.connect(
        L1_EXECUTOR_ADDR,
        deployWallet
      );

      const tokenProxy = TransparentUpgradeableProxy__factory.connect(
        CONTRACTS_L2_LIDO_TOKEN_ADDR,
        zkWallet
      );

      const proxyAdmin = ProxyAdmin__factory.connect(
        L2_TOKEN_PROXY_ADMIN,
        zkWallet
      );

      const proxyAdminOwner = await proxyAdmin.owner();

      console.log("ADMIN OWNER L2 address:", proxyAdminOwner);

      console.log(
        "ADMIN OWNER L1 address:",
        utils.undoL1ToL2Alias(proxyAdminOwner)
      );

      // encode data to be executed by ProxyAdmin
      const data = proxyAdmin.interface.encodeFunctionData("upgrade", [
        CONTRACTS_L2_LIDO_TOKEN_ADDR,
        NEW_L2_TOKEN_IMPL,
      ]);

      // estimate gas to bridge encoded from L1 to L2
      const gasLimit = await zkProvider.estimateL1ToL2Execute({
        contractAddress: L2_TOKEN_PROXY_ADMIN,
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
       * * This data contains previously encoded data
       */
      const encodedData = L1Executor.interface.encodeFunctionData(
        "callZkSync",
        [
          L2_TOKEN_PROXY_ADMIN,
          data,
          gasLimit,
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
        ]
      );

      const executeTx = await L1GovernorAgent.execute(
        L1_EXECUTOR_ADDR,
        baseCost,
        encodedData,
        { gasPrice, gasLimit: 10_000_000 }
      );

      const upgradedPromise = new Promise((resolve) => {
        tokenProxy.on("Upgraded", (address) => {
          resolve(address);
          tokenProxy.removeAllListeners();
        });
      });

      const newImplAddress = await upgradedPromise.then((res) => res);

      console.log("New wstETH proxy implementation address", newImplAddress);

      await executeTx.wait();

      const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
        executeTx
      );
      await l2Response2.wait();
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  throw error;
});
