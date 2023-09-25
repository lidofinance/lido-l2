import {
  REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
  getNumberFromEnv,
  readBytecode,
  web3Provider,
} from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

import * as path from "path";

const provider = web3Provider();

const commonArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "l2/artifacts-zk/common"
);

const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "l2/artifacts-zk/l2/contracts"
);

const l2ProxyArtifactsPath = path.join(commonArtifactsPath, "proxy");

const L2_LIDO_BRIDGE_PROXY_BYTECODE = readBytecode(
  l2ProxyArtifactsPath,
  "OssifiableProxy"
);

const L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE = readBytecode(
  l2ArtifactsPath,
  "L2ERC20Bridge"
);

const DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT = getNumberFromEnv(
  "CONTRACTS_DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT"
);

async function main() {
  const program = new Command();

  program.version("0.1.0").name("initialize-lido-bridges");

  program
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--nonce <nonce>")
    .option("--lido-bridge <lido-bridge>")
    .action(async (cmd) => {
      const PRIVATE_KEY = process.env.PRIVATE_KEY as string;

      const L1_GOVERNANCE_AGENT_ADDR = process.env
        .CONTRACTS_L1_GOVERNANCE_AGENT_ADDR as string;
      const L2_GOVERNOR_ADDRESS = process.env.L2_BRIDGE_EXECUTOR_ADDR as string;

      const CONTRACTS_L1_LIDO_TOKEN_ADDR = process.env
        .CONTRACTS_L1_LIDO_TOKEN_ADDR as string;

      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : new Wallet(PRIVATE_KEY, provider);

      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : await provider.getGasPrice();

      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const nonce = cmd.nonce
        ? parseInt(cmd.nonce)
        : await deployWallet.getTransactionCount();

      const deployer = new Deployer({
        deployWallet,
        governorAddress: deployWallet.address,
        verbose: true,
      });

      const lidoBridge = cmd.lidoBridge
        ? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
        : deployer.defaultLidoBridge(deployWallet);

      const zkSync = deployer.zkSyncContract(deployWallet);
      console.log("Governor:", L2_GOVERNOR_ADDRESS);

      console.log("wstETH L1 token:", CONTRACTS_L1_LIDO_TOKEN_ADDR);
      console.log("wstETH L2 token:", deployer.addresses.LidoTokenL2);

      const requiredValueToInitializeBridge =
        await zkSync.l2TransactionBaseCost(
          gasPrice,
          DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT,
          REQUIRED_L2_GAS_PRICE_PER_PUBDATA
        );

      try {
        console.log("Initializing bridges");

        const tx = await lidoBridge.initialize(
          [
            L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE,
            L2_LIDO_BRIDGE_PROXY_BYTECODE,
          ],
          [
            deployer.addresses.LidoTokenL1,
            deployer.addresses.LidoTokenL2,
            L2_GOVERNOR_ADDRESS,
            deployWallet.address, // default admin for L1 Bridge -> later transfer role L1: Governor Agent, L2: ZkSyncBridgeExecutor on zkSync
            deployer.addresses.ZkSync.DiamondProxy,
          ] as any,
          requiredValueToInitializeBridge,
          requiredValueToInitializeBridge,
          {
            gasPrice,
            nonce: nonce,
            value: requiredValueToInitializeBridge.mul(2),
            gasLimit: 10000000,
          }
        );

        const receipt = await tx.wait();
        console.log(
          `CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR=${await lidoBridge.l2Bridge()}`
        );
        console.log(`Gas used: `, receipt.gasUsed.toString());
      } catch (err) {
        console.log("Error", err);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  throw err;
});
