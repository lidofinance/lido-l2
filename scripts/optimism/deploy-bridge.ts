import hre from "hardhat";
import chalk from "chalk";
import { getDeployer } from "../../utils/deployment/network";
import { promptProceed } from "../../utils/prompt";
import { createOptimismBridgeDeployScripts } from "../../utils/deployment/optimism";
import { getAddress, getEnvVariable } from "../../utils/env";

async function main() {
  const l1Network = getEnvVariable("L1_NETWORK");
  const l2Network = getEnvVariable("L2_NETWORK");
  const l1Token = getAddress("L1_TOKEN", hre);
  const l1ProxyAdmin = getAddress("L1_PROXY_ADMIN", hre);
  const l1BridgeAdmin = getAddress("L1_BRIDGE_ADMIN", hre);
  const l2ProxyAdmin = getAddress("L2_PROXY_ADMIN", hre);
  const l2BridgeAdmin = getAddress("L2_BRIDGE_ADMIN", hre);

  const l1Deployer = getDeployer(l1Network, hre);
  const l2Deployer = getDeployer(l2Network, hre);

  const [l1DeployScript, l2DeployScript] =
    await createOptimismBridgeDeployScripts(
      l1Token,
      {
        deployer: l1Deployer,
        admins: { proxy: l1ProxyAdmin, bridge: l1BridgeAdmin },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2ProxyAdmin, bridge: l2BridgeAdmin },
      }
    );

  console.log(chalk.bold("L1 Bridge Deployment Script:"));
  console.log(`  · L1 Network: ${l1Network}`);
  console.log(`  · L1 Token: ${chalk.underline(l1Token)}`);
  console.log(`  · L1 Proxy Admin: ${chalk.underline(l1ProxyAdmin)}`);
  console.log(`  · L1 Bridge Admin: ${chalk.underline(l1BridgeAdmin)}`);
  console.log(`  · L1 Deployer: ${chalk.underline(l1Deployer.address)}`);
  console.log();
  l1DeployScript.print();
  console.log(chalk.bold("L2 Bridge Deployment Script:"));
  console.log(`  · L2 Network: ${l2Network}`);
  console.log(`  · L2 Proxy Admin: ${l2ProxyAdmin}`);
  console.log(`  · L2 Bridge Admin: ${l2BridgeAdmin}`);
  console.log(`  · L2 Deployer: ${l2Deployer.address}`);
  console.log();
  l2DeployScript.print();

  await promptProceed();

  await l1DeployScript.run();
  await l2DeployScript.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
