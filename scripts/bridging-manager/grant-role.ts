import hre from "hardhat";
import { getDeployer, getNetworkConfig } from "../../utils/deployment/network";
import { getAddress, getEnum, getEnvVariable } from "../../utils/env";
import { BridgingManager__factory } from "../../typechain";
import { promptProceed } from "../../utils/prompt";
import chalk from "chalk";

const ALLOWED_ROLES = [
  "DEPOSITS_ENABLER_ROLE",
  "DEPOSITS_DISABLER_ROLE",
  "WITHDRAWALS_ENABLER_ROLE",
  "WITHDRAWALS_DISABLER_ROLE",
];

async function main() {
  const network = getNetworkConfig(
    getEnvVariable("L1_NETWORK", "") || getEnvVariable("L2_NETWORK", ""),
    hre
  );

  const deployer = getDeployer(network.url);
  const managerAddress = getAddress("MANAGER", hre);
  const account = getAddress("ACCOUNT", hre);
  const roleName = getEnum("ROLE", ALLOWED_ROLES);

  console.log(
    `Grant role ${chalk.green(roleName)} on contract ${chalk.underline(
      managerAddress
    )} to account ${chalk.underline(account)}`
  );
  await promptProceed();

  const manager = await BridgingManager__factory.connect(
    managerAddress,
    deployer
  );

  // @ts-ignore
  const role = await manager[roleName]();

  const tx = await manager.grantRole(role, account);

  console.log(`Waiting for tx: ${tx.hash}`);
  await tx.wait();
  console.log("OK: Role was successfully granted!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
