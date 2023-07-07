/* eslint-disable prettier/prettier */
import * as hre from "hardhat";
import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { Interface, formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// typechain
import { L1Executor__factory } from "../typechain/factories/l1/contracts/governance/L1Executor__factory";

// L2
import { Wallet as ZkSyncWallet, Provider, utils, Contract } from "zksync-web3";
const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL as string;

const L1_EXECUTOR_ADDR = process.env.L1_EXECUTOR_ADDR as string;

const L2_WSTETH_ADMIN = "0x23357735Dc5529ca0ae9de94ce2edD7eA905B635";
const L2_WSTETH_PROXY = "0x219C645ba345C8d1D8e2549407b0b211436Dc7E0";
const NEW_TOKEN_IMPL = "0x1955D8fa2B0FA5CC100609eE35231634942A7442";

const provider = web3Provider();
const zkProvider = new Provider(ZK_CLIENT_WEB3_URL, 270);

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

      const ITokenProxy = new Interface([
        "event Upgraded(address indexed implementation)",
      ]);

      const IProxyAdmin = new Interface([
        "function upgrade(address proxy, address implementation)",
        "function owner() public view virtual returns (address)",
      ]);

      const tokenProxyContract = new Contract(
        L2_WSTETH_PROXY,
        ITokenProxy,
        zkWallet
      );

      const proxyAdminContract = new Contract(
        L2_WSTETH_ADMIN,
        IProxyAdmin,
        zkWallet
      );

      const proxyAdminOwner = await proxyAdminContract.owner();

      console.log("ADMIN OWNER L2 address:", proxyAdminOwner);

      console.log(
        "ADMIN OWNER L1 address:",
        utils.undoL1ToL2Alias(proxyAdminOwner)
      );

      // encode data to be executed by ProxyAdmin
      const data = IProxyAdmin.encodeFunctionData("upgrade", [
        L2_WSTETH_PROXY,
        NEW_TOKEN_IMPL,
      ]);

      // estimate gas to to bridge encoded from L1 to L2
      const gasLimit = await zkProvider.estimateL1ToL2Execute({
        contractAddress: L2_WSTETH_ADMIN,
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
          zkSync.address,
          L2_WSTETH_ADMIN,
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
        tokenProxyContract.on("Upgraded", (address) => {
          resolve(address);
          tokenProxyContract.removeAllListeners();
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
