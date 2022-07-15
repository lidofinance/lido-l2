import hre from "hardhat";
import chalk from "chalk";
import { Signer, Wallet } from "ethers";
import { BridgingManager, BridgingManager__factory } from "../typechain";
import { getRoleHolders } from "./testing";

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
    this.hash =
      name === "DEFAULT_ADMIN_ROLE"
        ? "0x0000000000000000000000000000000000000000000000000000000000000000"
        : hre.ethers.utils.id(`BridgingManager.${name}`);
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
  private readonly admin: Wallet | Signer;
  public readonly bridgingManager: BridgingManager;
  private readonly logger: BridgingManagementLogger;

  static async getAdmins(bridgingManager: BridgingManager) {
    const l1GatewayAdminAddresses = await getRoleHolders(
      bridgingManager,
      BridgingManagerRole.DEFAULT_ADMIN_ROLE.hash
    );
    return Array.from(l1GatewayAdminAddresses);
  }

  constructor(
    address: string,
    admin: Wallet | Signer,
    options: { logger?: Logger } = {}
  ) {
    this.bridgingManager = BridgingManager__factory.connect(address, admin);
    this.logger = new BridgingManagementLogger(options?.logger);
    this.admin = admin;
  }

  async setup(config: BridgingManagerSetupConfig) {
    this.logger.logSetupTitle(this.bridgingManager.address);

    const adminAddress = await this.admin.getAddress();

    if (config.bridgeAdmin !== adminAddress) {
      await this.grantRole(BridgingManagerRole.DEFAULT_ADMIN_ROLE, [
        config.bridgeAdmin,
      ]);
    }

    await this.grantManagerRoles({
      ...config,
      depositsEnablers: config.depositsEnabled
        ? [adminAddress, ...(config.depositsEnablers || [])]
        : config.depositsEnablers,
      withdrawalsEnablers: config.withdrawalsEnabled
        ? [adminAddress, ...(config.withdrawalsEnablers || [])]
        : config.withdrawalsEnablers,
    });

    if (config.depositsEnabled) {
      const isDepositsEnabled = await this.bridgingManager.isDepositsEnabled();
      if (!isDepositsEnabled) {
        await this.enableDeposits();
      }
      await this.renounceRole(BridgingManagerRole.DEPOSITS_ENABLER_ROLE);
    }

    if (config.withdrawalsEnabled) {
      const isWithdrawalsEnabled =
        await this.bridgingManager.isWithdrawalsEnabled();
      if (!isWithdrawalsEnabled) {
        await this.enableWithdrawals();
      }
      await this.renounceRole(BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE);
    }

    if (config.bridgeAdmin !== adminAddress) {
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
    const adminAddress = await this.admin.getAddress();
    this.logger.logRenounceRole(role, adminAddress);
    const tx = await this.bridgingManager.renounceRole(role.hash, adminAddress);
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
