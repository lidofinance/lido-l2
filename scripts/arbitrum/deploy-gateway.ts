import hre from "hardhat";
import chalk from "chalk";
import { getDeployer, getNetworkConfig } from "../../utils/deployment/network";
import { promptProceed } from "../../utils/prompt";
import arbitrum from "../../utils/arbitrum";
import env from "../../utils/env";

async function main() {
  const l1NetworkName = env.string("L1_NETWORK");
  const l2NetworkName = env.string("L2_NETWORK");
  const l1Network = getNetworkConfig(l1NetworkName, hre);
  const l2Network = getNetworkConfig(l2NetworkName, hre);
  const l1Token = env.address("L1_TOKEN");
  const l1ProxyAdmin = env.address("L1_PROXY_ADMIN");
  const l1BridgeAdmin = env.address("L1_BRIDGE_ADMIN");
  const l2ProxyAdmin = env.address("L2_PROXY_ADMIN");
  const l2BridgeAdmin = env.address("L2_BRIDGE_ADMIN");

  const l1Deployer = getDeployer(l1Network.url);
  const l2Deployer = getDeployer(l2Network.url);

  const [l1DeployScript, l2DeployScript] =
    await arbitrum.deployment.createGatewayDeployScripts(
      l1Token,
      {
        deployer: l1Deployer,
        admins: { proxy: l1ProxyAdmin, bridge: l1BridgeAdmin },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2ProxyAdmin, bridge: l2BridgeAdmin },
      },
      {
        logger: console,
      }
    );

  console.log(chalk.bold("L1 Gateway Deployment Script:"));
  console.log(`  · L1 Network: ${l1NetworkName}`);
  console.log(`  · L1 Token: ${chalk.underline(l1Token)}`);
  console.log(`  · L1 Proxy Admin: ${chalk.underline(l1ProxyAdmin)}`);
  console.log(`  · L1 Gateway Admin: ${chalk.underline(l1BridgeAdmin)}`);
  console.log(`  · L1 Deployer: ${chalk.underline(l1Deployer.address)}`);
  console.log();

  l1DeployScript.print();
  console.log(chalk.bold("L2 Gateway Deployment Script:"));
  console.log(`  · L2 Network: ${l2NetworkName}`);
  console.log(`  · L2 Proxy Admin: ${l2ProxyAdmin}`);
  console.log(`  · L2 Gateway Admin: ${l2BridgeAdmin}`);
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
