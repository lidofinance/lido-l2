import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// L2
import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-web3";
import { L2ERC20Bridge__factory } from "../../l2/typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL || "";

const L2_BRIDGE_EXECUTOR_ADDR = process.env.L2_BRIDGE_EXECUTOR_ADDR as string;

const provider = web3Provider();
const zkProvider = new Provider(ZK_CLIENT_WEB3_URL, 270);

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

      // get bytecode for roles
      const DEFAULT_ADMIN_ROLE = await lidoBridge.DEFAULT_ADMIN_ROLE();
      const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();
      const DEPOSITS_DISABLER_ROLE = await lidoBridge.DEPOSITS_DISABLER_ROLE();
      const WITHDRAWALS_ENABLER_ROLE =
        await lidoBridge.WITHDRAWALS_ENABLER_ROLE();
      const WITHDRAWALS_DISABLER_ROLE =
        await lidoBridge.WITHDRAWALS_DISABLER_ROLE();

      console.log("\n===============L1===============");

      await initializeBridgingManager(lidoBridge, deployWallet.address);

      await grantRole(
        lidoBridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        deployer.addresses.GovernanceL1
      );

      await grantRole(
        lidoBridge,
        DEPOSITS_ENABLER_ROLE,
        "DEPOSITS_ENABLER_ROLE",
        deployer.addresses.GovernanceL1
      );

      await grantRole(
        lidoBridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        deployer.addresses.GovernanceL1
      );

      await grantRole(
        lidoBridge,
        WITHDRAWALS_ENABLER_ROLE,
        "WITHDRAWALS_ENABLER_ROLE",
        deployer.addresses.GovernanceL1
      );

      await grantRole(
        lidoBridge,
        WITHDRAWALS_DISABLER_ROLE,
        "WITHDRAWALS_DISABLER_ROLE",
        deployer.addresses.GovernanceL1
      );

      /**
       * Revokes deployer's DEFAULT_ADMIN_ROLE on L1
       */
      await revokeRole(
        lidoBridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        deployWallet.address
      );

      console.log("\n===============L2===============");

      await initializeBridgingManager(l2Bridge, zkWallet.address);

      await grantRole(
        l2Bridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        L2_BRIDGE_EXECUTOR_ADDR
      );

      await grantRole(
        l2Bridge,
        DEPOSITS_ENABLER_ROLE,
        "DEPOSITS_ENABLER_ROLE",
        L2_BRIDGE_EXECUTOR_ADDR
      );

      await grantRole(
        l2Bridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        L2_BRIDGE_EXECUTOR_ADDR
      );

      await grantRole(
        l2Bridge,
        WITHDRAWALS_ENABLER_ROLE,
        "WITHDRAWALS_ENABLER_ROLE",
        L2_BRIDGE_EXECUTOR_ADDR
      );

      await grantRole(
        l2Bridge,
        WITHDRAWALS_DISABLER_ROLE,
        "WITHDRAWALS_DISABLER_ROLE",
        L2_BRIDGE_EXECUTOR_ADDR
      );

      /**
       * Revokes deployer's DEFAULT_ADMIN_ROLE on L2
       */
      await revokeRole(
        l2Bridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        zkWallet.address
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
  target: string
) {
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

/**
 * initializeBridgingManager
 */
async function initializeBridgingManager(contract: Contract, target: string) {
  const isInitiated = await contract.isInitialized();

  if (!isInitiated) {
    console.log("Initializing Bridge Default Admin...");
    const tx = await contract["initialize(address)"](target);
    await tx.wait();
  }
  console.log("Bridging manager initiated");
}

main().catch((error) => {
  throw error;
});
