import "@nomiclabs/hardhat-ethers";
import { Command } from "commander";
import { web3Provider } from "./utils/utils";

import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Deployer } from "./deploy";

const provider = web3Provider();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

async function main() {
  const program = new Command();
  program
    .version("0.1.0")
    .name("deploy-create2-factory")
    .description("Deploy Create2 Factory contract");

  program
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--nonce <nonce>")
    .action(async (cmd) => {
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
      console.log(`Using nonce: ${nonce}`);

      const deployer = new Deployer({
        deployWallet,
        verbose: true,
      });

      await deployer.deployCreate2Factory({ nonce, gasPrice });
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  throw new Error("Error:" + err);
});
