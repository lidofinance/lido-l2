import hre from "hardhat";
import env from "./env";
import { Wallet } from "ethers";
import { BridgingManager, BridgingManager__factory } from "../typechain";
import { getDeployer, getNetworkConfig } from "./deployment/network";
import { HttpNetworkConfig } from "hardhat/types";
import chalk from "chalk";
import { DeployScript, Logger } from "./deployment/DeployScript";

type BridgingManagerRoleName =
  | "DEFAULT_ADMIN_ROLE"
  | "DEPOSITS_ENABLER_ROLE"
  | "DEPOSITS_DISABLER_ROLE"
  | "WITHDRAWALS_ENABLER_ROLE"
  | "WITHDRAWALS_DISABLER_ROLE";

class BridgingManagerRole {
  public static get DEFAULT_ADMIN_ROLE() {
    return new BridgingManagerRole("DEFAULT_ADMIN_ROLE");
  }

  public static get DEPOSITS_ENABLER_ROLE() {
    return new BridgingManagerRole("DEPOSITS_ENABLER_ROLE");
  }

  public static get DEPOSITS_DISABLER_ROLE() {
    return new BridgingManagerRole("DEPOSITS_DISABLER_ROLE");
  }

  public static get WITHDRAWALS_ENABLER_ROLE() {
    return new BridgingManagerRole("WITHDRAWALS_ENABLER_ROLE");
  }

  public static get WITHDRAWALS_DISABLER_ROLE() {
    return new BridgingManagerRole("WITHDRAWALS_DISABLER_ROLE");
  }

  public readonly name: BridgingManagerRoleName;
  public readonly hash: string;

  private constructor(name: BridgingManagerRoleName) {
    this.name = name;
    this.hash = hre.ethers.utils.id(`BridgingManager.${name}`);
  }
}

export interface BridgingManagerConfig {
  deployer: Wallet;
  bridgeAdmin: string;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  depositsEnablers: string[];
  depositsDisablers: string[];
  withdrawalsEnablers: string[];
  withdrawalsDisablers: string[];
}

interface LayerBridgeDeployParams extends BridgingManagerConfig {
  networkName: string;
  proxyAdmin: string;
  network: HttpNetworkConfig;
}

interface BridgeDeployParams {
  token: string;
  l1: LayerBridgeDeployParams;
  l2: LayerBridgeDeployParams;
}

export async function setupBridgingManager(
  bridgingManagerAddress: string,
  params: BridgingManagerConfig,
  options?: { title?: string; logger: Logger }
) {
  // setup the bridge from temporary deployer owner
  const bridgingManager = BridgingManager__factory.connect(
    bridgingManagerAddress,
    params.deployer
  );

  if (options?.title && options?.logger) {
    options.logger.log(
      chalk.bold(`${options.title} :: ${bridgingManagerAddress}\n`)
    );
  }

  // by default deployer has DEFAULT_ADMIN_ROLE
  if (params.bridgeAdmin !== params.deployer.address) {
    await grantRole(bridgingManager, BridgingManagerRole.DEFAULT_ADMIN_ROLE, [
      params.bridgeAdmin,
    ]);
  }

  const depositsEnablers = params.depositsEnabled
    ? [params.deployer.address, ...params.depositsEnablers]
    : params.depositsEnablers;
  await grantRole(
    bridgingManager,
    BridgingManagerRole.DEPOSITS_ENABLER_ROLE,
    depositsEnablers
  );

  await grantRole(
    bridgingManager,
    BridgingManagerRole.DEPOSITS_DISABLER_ROLE,
    params.depositsDisablers
  );

  const withdrawalsDisablers = params.withdrawalsEnabled
    ? [params.deployer.address, ...params.withdrawalsEnablers]
    : params.withdrawalsEnablers;
  await grantRole(
    bridgingManager,
    BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE,
    withdrawalsDisablers
  );

  await grantRole(
    bridgingManager,
    BridgingManagerRole.WITHDRAWALS_DISABLER_ROLE,
    params.withdrawalsDisablers
  );

  if (params.depositsEnabled) {
    await enableDeposits(bridgingManager);
    await renounceRole(
      bridgingManager,
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE,
      [params.deployer.address]
    );
  }

  if (params.withdrawalsEnabled) {
    await enableWithdrawals(bridgingManager);
    await renounceRole(
      bridgingManager,
      BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE,
      [params.deployer.address]
    );
  }

  // Renounce DEFAULT_ADMIN_ROLE from deployer only if it is not bridge admin
  if (params.bridgeAdmin !== params.deployer.address) {
    await renounceRole(
      bridgingManager,
      BridgingManagerRole.DEFAULT_ADMIN_ROLE,
      [params.deployer.address]
    );
  }
}

async function enableDeposits(
  bridgingManager: BridgingManager,
  logger?: Logger
) {
  logger?.log(`Enable deposits`);
  const tx = await bridgingManager.enableDeposits();
  logger?.log(`  Waiting for tx ${tx.hash}`);
  await tx.wait();
  logger?.log(`  Deposits successfully enabled\n`);
}

async function enableWithdrawals(
  bridgingManager: BridgingManager,
  logger?: Logger
) {
  logger?.log(`Enable withdrawals`);
  const tx = await bridgingManager.enableWithdrawals();
  logger?.log(`  Waiting for tx ${tx.hash}`);
  await tx.wait();
  logger?.log(`  Withdrawals successfully enabled\n`);
}

async function renounceRole(
  bridgingManager: BridgingManager,
  role: BridgingManagerRole,
  accounts: string[],
  logger?: Logger
) {
  for (const account of accounts) {
    logger?.log(
      `Renounce ${chalk.yellowBright(role.name)} (${chalk.cyan(role.hash)})`
    );
    const tx = await bridgingManager.renounceRole(role.hash, account);
    logger?.log(`  Waiting for tx ${tx.hash}`);
    await tx.wait();
    logger?.log(`  Role successfully renounced\n`);
  }
}

async function grantRole(
  bridgingManager: BridgingManager,
  role: BridgingManagerRole,
  accounts: string[],
  logger?: Logger
) {
  for (const account of accounts) {
    logger?.log(
      `Grant role ${chalk.yellowBright(role.name)} (${chalk.cyan(role.hash)}):`
    );
    logger?.log(`  Account: ${chalk.underline(account)}`);
    const tx = await bridgingManager.grantRole(role.hash, account);
    logger?.log(`  Waiting for tx: ${tx.hash}`);
    await tx.wait();
    logger?.log(`Role successfully granted!\n`);
  }
}

export function loadDeploymentParams() {
  const l1NetworkName = env.string("L1_NETWORK");
  const l2NetworkName = env.string("L2_NETWORK");
  const l1Network = getNetworkConfig(l1NetworkName, hre);
  const l2Network = getNetworkConfig(l2NetworkName, hre);

  return {
    token: env.address("L1_TOKEN"),
    l1: {
      network: l1Network,
      networkName: l1NetworkName,
      proxyAdmin: env.address("L1_PROXY_ADMIN"),
      deployer: getDeployer(l1Network.url),
      bridgeAdmin: env.address("L1_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L1_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L1_DEPOSITS_ENABLED", false),
      depositsEnablers: env.addresses("L1_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L1_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L1_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L1_WITHDRAWALS_DISABLERS", []),
    },
    l2: {
      network: l1Network,
      networkName: l2NetworkName,
      deployer: getDeployer(l2Network.url),
      proxyAdmin: env.address("L2_PROXY_ADMIN"),
      bridgeAdmin: env.address("L2_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L2_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L2_DEPOSITS_ENABLED", false),
      depositsEnablers: env.addresses("L2_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L2_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L2_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L2_WITHDRAWALS_DISABLERS", []),
    },
  };
}

export function printDeploymentInfo(
  title: string,
  params: BridgeDeployParams,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript,
  logger?: Logger
) {
  logger?.log(chalk.bold(`${title} :: ${chalk.underline(params.token)}\n`));
  logger?.log(chalk.bold("  · L1 Deployment Params:"));
  printLayerDeploymentInfo(params.l1, { logger });
  logger?.log();
  logger?.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  logger?.log(chalk.bold("  · L2 Deployment Params:"));
  printLayerDeploymentInfo(params.l2, { logger });
  logger?.log();
  logger?.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}

function printLayerDeploymentInfo(
  params: LayerBridgeDeployParams,
  options?: { padding?: number; logger?: Logger }
) {
  const { logger, padding = 4 } = options || {};
  const pad = " ".repeat(padding);
  logger?.log(`${pad}· Network: ${params.networkName}`);
  logger?.log(`${pad}· Deployer: ${chalk.underline(params.deployer.address)}`);
  logger?.log(`${pad}· Proxy Admin: ${chalk.underline(params.proxyAdmin)}`);
  logger?.log(`${pad}· Bridge Admin: ${chalk.underline(params.bridgeAdmin)}`);
  logger?.log(`${pad}· Deposits Enabled: ${params.depositsEnabled}`);
  logger?.log(
    `${pad}· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
  );
  logger?.log(
    `${pad}· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
  );
  logger?.log(
    `${pad}· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
  );
  logger?.log(
    `${pad}· Withdrawals Enablers: ${JSON.stringify(
      params.withdrawalsEnablers
    )}`
  );
  logger?.log(
    `${pad}· Withdrawals Disablers: ${JSON.stringify(
      params.withdrawalsDisablers
    )}`
  );
}

export default {
  setupBridgingManager,
  loadDeploymentParams,
  printDeploymentInfo,
};
