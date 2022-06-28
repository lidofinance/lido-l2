import hre from "hardhat";
import chalk from "chalk";
import { Wallet } from "ethers";
import { BridgingManager, BridgingManager__factory } from "../typechain";

interface Logger {
  log(message: string): void;
}

type BridgingManagerRoleName =
  | "DEFAULT_ADMIN_ROLE"
  | "DEPOSITS_ENABLER_ROLE"
  | "DEPOSITS_DISABLER_ROLE"
  | "WITHDRAWALS_ENABLER_ROLE"
  | "WITHDRAWALS_DISABLER_ROLE";

export class BridgingManagerRole {
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

interface BridgingGrantManagerRolesConfig {
  depositsEnablers?: string[];
  depositsDisablers?: string[];
  withdrawalsEnablers?: string[];
  withdrawalsDisablers?: string[];
}

export interface BridgingManagerSetupConfig
  extends BridgingGrantManagerRolesConfig {
  bridgeAdmin: string;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
}

export class BridgingManagement {
  private readonly admin: Wallet;
  public readonly bridgingManager: BridgingManager;
  private readonly logger: BridgingManagementLogger;

  constructor(
    address: string,
    admin: Wallet,
    options: { logger?: Logger } = {}
  ) {
    this.bridgingManager = BridgingManager__factory.connect(address, admin);
    this.logger = new BridgingManagementLogger(options?.logger);
    this.admin = admin;
  }

  async setup(config: BridgingManagerSetupConfig) {
    this.logger.logSetupTitle(this.bridgingManager.address);

    if (config.bridgeAdmin !== this.admin.address) {
      await this.grantRole(BridgingManagerRole.DEFAULT_ADMIN_ROLE, [
        config.bridgeAdmin,
      ]);
    }

    await this.grantManagerRoles({
      ...config,
      depositsEnablers: config.depositsEnabled
        ? [this.admin.address, ...(config.depositsEnablers || [])]
        : config.depositsEnablers,
      withdrawalsEnablers: config.withdrawalsEnabled
        ? [this.admin.address, ...(config.withdrawalsEnablers || [])]
        : config.withdrawalsEnablers,
    });

    if (config.depositsEnabled) {
      await this.enableDeposits();
      await this.renounceRole(BridgingManagerRole.DEPOSITS_ENABLER_ROLE);
    }

    if (config.withdrawalsEnabled) {
      await this.enableWithdrawals();
      await this.renounceRole(BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE);
    }

    if (config.bridgeAdmin !== this.admin.address) {
      await this.grantRole(BridgingManagerRole.DEFAULT_ADMIN_ROLE, [
        config.bridgeAdmin,
      ]);
      await this.renounceRole(BridgingManagerRole.DEFAULT_ADMIN_ROLE);
    }
  }

  async grantManagerRoles(params: BridgingGrantManagerRolesConfig) {
    await this.grantRole(
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE,
      params.depositsEnablers || []
    );

    await this.grantRole(
      BridgingManagerRole.DEPOSITS_DISABLER_ROLE,
      params.depositsDisablers || []
    );

    await this.grantRole(
      BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE,
      params.withdrawalsEnablers || []
    );

    await this.grantRole(
      BridgingManagerRole.WITHDRAWALS_DISABLER_ROLE,
      params.withdrawalsDisablers || []
    );
  }

  async grantRole(role: BridgingManagerRole, accounts: string[]) {
    for (const account of accounts) {
      this.logger.logGrantRole(role, account);
      const tx = await this.bridgingManager.grantRole(role.hash, account);
      this.logger.logTxWaiting(tx.hash);
      await tx.wait();
      this.logger.logStepDone();
    }
  }

  async renounceRole(role: BridgingManagerRole) {
    this.logger.logRenounceRole(role, this.admin.address);
    const tx = await this.bridgingManager.renounceRole(
      role.hash,
      this.admin.address
    );
    this.logger.logTxWaiting(tx.hash);
    await tx.wait();
    this.logger.logStepDone();
  }

  async enableDeposits() {
    this.logger.logEnableDeposits();
    const tx = await this.bridgingManager.enableDeposits();
    this.logger.logTxWaiting(tx.hash);
    await tx.wait();
    this.logger.logStepDone();
  }

  async enableWithdrawals() {
    this.logger.logEnableWithdrawals();
    const tx = await this.bridgingManager.enableWithdrawals();
    this.logger.logTxWaiting(tx.hash);
    await tx.wait();
    this.logger.logStepDone();
  }
}

class BridgingManagementLogger {
  private readonly logger?: Logger;
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  logRenounceRole(role: BridgingManagerRole, account: string) {
    this.logger?.log(`Renounce role ${chalk.yellowBright(role.name)}:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· role")} ${chalk.green(role.hash)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· account")} ${chalk.green.underline(account)}`
    );
  }

  logGrantRole(role: BridgingManagerRole, account: string) {
    this.logger?.log(`Grant role ${chalk.yellowBright(role.name)}:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· role")} ${chalk.green(role.hash)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· account")} ${chalk.green.underline(account)}`
    );
  }

  logTxWaiting(txHash: string) {
    this.logger?.log(`Waiting for tx: ${txHash}`);
  }

  logStepDone() {
    this.logger?.log(`[${chalk.greenBright("DONE")}]\n`);
  }

  logSetupTitle(bridgingManagerAddress: string) {
    this.logger?.log(
      chalk.bold(`Setup Bridging Manager :: ${bridgingManagerAddress}`)
    );
  }

  logEnableDeposits() {
    this.logger?.log(`Enable deposits`);
  }

  logEnableWithdrawals() {
    this.logger?.log(`Enable withdrawals`);
  }
}
