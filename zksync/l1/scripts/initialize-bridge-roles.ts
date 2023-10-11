import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { Command } from "commander";
import { Deployer } from "./deploy";

// L2
import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-web3";
import { L2ERC20Bridge__factory } from "../../l2/typechain";
import { L1ERC20Bridge__factory } from "../typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;
const L1_EMERGENCY_BRAKE_MULTISIG = process.env
  .L1_EMERGENCY_BRAKE_MULTISIG as string;
const L2_EMERGENCY_BRAKE_MULTISIG = process.env
  .L2_EMERGENCY_BRAKE_MULTISIG as string;
const L2_BRIDGE_EXECUTOR_ADDR = process.env.L2_BRIDGE_EXECUTOR_ADDR as string;

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

      // get bytecode for roles
      const DEFAULT_ADMIN_ROLE =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
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
        [deployer.addresses.GovernanceL1, L1_EMERGENCY_BRAKE_MULTISIG]
      );

      await grantRole(
        lidoBridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        [
          deployer.addresses.GovernanceL1,
          L1_EMERGENCY_BRAKE_MULTISIG,
          deployWallet.address,
        ]
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
        [deployer.addresses.GovernanceL1, L1_EMERGENCY_BRAKE_MULTISIG]
      );

      await grantRole(lidoBridge, DEFAULT_ADMIN_ROLE, "DEFAULT_ADMIN_ROLE", [
        L1_EMERGENCY_BRAKE_MULTISIG,
      ]);

      const disableDepositsTx = await L1ERC20Bridge__factory.connect(
        deployer.addresses.Bridges.LidoBridgeProxy,
        deployWallet
      ).disableDeposits();

      await disableDepositsTx.wait();

      await revokeRole(
        lidoBridge,
        DEPOSITS_DISABLER_ROLE,
        "DEPOSITS_DISABLER_ROLE",
        deployWallet.address
      );

      await revokeRole(
        lidoBridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        deployWallet.address
      );

      console.log(
        "EXPECTED ADMIN:",
        await lidoBridge.hasRole(
          DEFAULT_ADMIN_ROLE,
          L1_EMERGENCY_BRAKE_MULTISIG
        )
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
        [L2_BRIDGE_EXECUTOR_ADDR, L2_EMERGENCY_BRAKE_MULTISIG]
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
        [L2_BRIDGE_EXECUTOR_ADDR, L2_EMERGENCY_BRAKE_MULTISIG]
      );

      await grantRole(l2Bridge, DEFAULT_ADMIN_ROLE, "DEFAULT_ADMIN_ROLE", [
        L2_BRIDGE_EXECUTOR_ADDR,
      ]);

      await revokeRole(
        l2Bridge,
        DEFAULT_ADMIN_ROLE,
        "DEFAULT_ADMIN_ROLE",
        deployWallet.address
      );

      console.log(
        "EXPECTED ADMIN:",
        await l2Bridge.hasRole(DEFAULT_ADMIN_ROLE, L2_BRIDGE_EXECUTOR_ADDR)
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
