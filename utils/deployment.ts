import chalk from "chalk";
import { BigNumber, Wallet } from "ethers";

import env from "./env";
import { DeployScript } from "./deployment/DeployScript";
import { BridgingManagerSetupConfig } from "./bridging-management";

interface ChainDeploymentConfig extends BridgingManagerSetupConfig {
  proxyAdmin: string;
}

interface MultiChainDeploymentConfig {
  /// L1
  l1TokenNonRebasable: string;
  l1RebasableToken: string;
  accountingOracle: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  l1TokenBridge: string;
  l1AuthorizedRebaseCaller: string;

  /// L2
  /// Oracle
  tokenRateOutdatedDelay: BigNumber;
  maxAllowedL2ToL1ClockLag: BigNumber;
  maxAllowedTokenRateDeviationPerDayBp: BigNumber;
  oldestRateAllowedInPauseTimeSpan: BigNumber;
  maxAllowedTimeBetweenTokenRateUpdates: BigNumber;
  tokenRateValue: BigNumber;
  tokenRateL1Timestamp: BigNumber;

  /// wstETH address to upgrade
  l2TokenNonRebasable: string;

  /// bridge
  l2TokenBridge: string;

  govBridgeExecutor: string;
  l1: ChainDeploymentConfig;
  l2: ChainDeploymentConfig;
}

export function loadMultiChainDeploymentConfig(): MultiChainDeploymentConfig {
  return {
    /// L1 Part
    l1TokenNonRebasable: env.address("L1_NON_REBASABLE_TOKEN"),
    l1RebasableToken: env.address("L1_REBASABLE_TOKEN"),
    accountingOracle: env.address("ACCOUNTING_ORACLE"),
    l2GasLimitForPushingTokenRate: BigNumber.from(env.string("L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE")),
    l1TokenBridge: env.address("L1_TOKEN_BRIDGE"),
    l1AuthorizedRebaseCaller: env.address("L1_AUTHORIZED_REBASE_CALLER"),

    /// L2 Part
    /// TokenRateOracle
    tokenRateOutdatedDelay: BigNumber.from(env.string("TOKEN_RATE_OUTDATED_DELAY")),
    maxAllowedL2ToL1ClockLag: BigNumber.from(env.string("MAX_ALLOWED_L2_TO_L1_CLOCK_LAG")),
    maxAllowedTokenRateDeviationPerDayBp: BigNumber.from(env.string("MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY_BP")),
    oldestRateAllowedInPauseTimeSpan: BigNumber.from(env.string("OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN")),
    maxAllowedTimeBetweenTokenRateUpdates: BigNumber.from(env.string("MAX_ALLOWED_TIME_BETWEEN_TOKEN_RATE_UPDATES")),
    tokenRateValue: BigNumber.from(env.string("TOKEN_RATE")),
    tokenRateL1Timestamp: BigNumber.from(env.string("TOKEN_RATE_L1_TIMESTAMP")),

    l2TokenNonRebasable: env.address("L2_TOKEN_NON_REBASABLE"),
    l2TokenBridge: env.address("L2_TOKEN_BRIDGE"),

    govBridgeExecutor: env.address("GOV_BRIDGE_EXECUTOR"),
    l1: {
      proxyAdmin: env.address("L1_PROXY_ADMIN"),
      bridgeAdmin: env.address("L1_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L1_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L1_WITHDRAWALS_ENABLED", false),
      depositsEnablers: env.addresses("L1_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L1_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L1_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L1_WITHDRAWALS_DISABLERS", []),
    },
    l2: {
      proxyAdmin: env.address("L2_PROXY_ADMIN"),
      bridgeAdmin: env.address("L2_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L2_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L2_WITHDRAWALS_ENABLED", false),
      depositsEnablers: env.addresses("L2_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L2_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L2_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L2_WITHDRAWALS_DISABLERS", []),
    },
  };
}

export async function printDeploymentConfig() {
  const pad = " ".repeat(4);
  console.log(`${pad}· Network: ${env.string("NETWORK")}`);
  console.log(`${pad}· Forking: ${env.bool("FORKING")}`);
}

export async function printMultiChainDeploymentConfig(
  title: string,
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  deploymentParams: MultiChainDeploymentConfig,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript
) {
  const { l1TokenNonRebasable, l1RebasableToken, l1, l2 } = deploymentParams;
  console.log(chalk.bold(`${title} :: ${chalk.underline(l1TokenNonRebasable)} :: ${chalk.underline(l1RebasableToken)}\n`));

  console.log(chalk.bold("  · Deployment Params:"));
  await printDeploymentConfig();
  console.log();

  console.log(chalk.bold("  · L1 Deployment Params:"));
  await printChainDeploymentConfig(l1Deployer, l1);
  console.log();
  console.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  console.log(chalk.bold("  · L2 Deployment Params:"));
  await printChainDeploymentConfig(l2Deployer, l2);
  console.log();
  console.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}

async function printChainDeploymentConfig(
  deployer: Wallet,
  params: ChainDeploymentConfig
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);
  console.log(`${pad}· Proxy Admin: ${chalk.underline(params.proxyAdmin)}`);
  console.log(`${pad}· Bridge Admin: ${chalk.underline(params.bridgeAdmin)}`);
  console.log(`${pad}· Deposits Enabled: ${params.depositsEnabled}`);
  console.log(
    `${pad}· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
  );
  console.log(
    `${pad}· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
  );
  console.log(
    `${pad}· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
  );
  console.log(
    `${pad}· Withdrawals Enablers: ${JSON.stringify(
      params.withdrawalsEnablers
    )}`
  );
  console.log(
    `${pad}· Withdrawals Disablers: ${JSON.stringify(
      params.withdrawalsDisablers
    )}`
  );
}

export default {
  loadMultiChainDeploymentConfig,
  printMultiChainDeploymentConfig,
};
