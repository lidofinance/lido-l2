import hre from "hardhat";
import chalk from "chalk";
import { writeFileSync } from "fs";
import { getDeployer, predictAddresses, getNetworkConfig } from "../../utils/deployment/network";
import { promptProceed } from "../../utils/prompt";
import { createOptimismBridgeDeployScripts } from "../../utils/deployment/optimism";
import { getAddress, getEnvVariable } from "../../utils/env";

async function main() {
  const l1NetworkName = getEnvVariable("L1_NETWORK");
  const l2NetworkName = getEnvVariable("L2_NETWORK");
  const l1Network = getNetworkConfig(l1NetworkName, hre);
  const l2Network = getNetworkConfig(l2NetworkName, hre);

  const l1Token = getAddress("L1_TOKEN", hre);
  const l1ProxyAdmin = getAddress("L1_PROXY_ADMIN", hre);
  const l1BridgeAdmin = getAddress("L1_BRIDGE_ADMIN", hre);
  const l2ProxyAdmin = getAddress("L2_PROXY_ADMIN", hre);
  const l2BridgeAdmin = getAddress("L2_BRIDGE_ADMIN", hre);

  const l1Deployer = getDeployer(l1Network.url);
  const l2Deployer = getDeployer(l2Network.url);

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
      },
      { logger: console }
    );

  console.log(chalk.bold("L1 Bridge Deployment Script:"));
  console.log(`  · L1 Network: ${l1NetworkName}`);
  console.log(`  · L1 Token: ${chalk.underline(l1Token)}`);
  console.log(`  · L1 Proxy Admin: ${chalk.underline(l1ProxyAdmin)}`);
  console.log(`  · L1 Bridge Admin: ${chalk.underline(l1BridgeAdmin)}`);
  console.log(`  · L1 Deployer: ${chalk.underline(l1Deployer.address)}`);
  console.log();
  l1DeployScript.print();

  console.log(chalk.bold("L2 Bridge Deployment Script:"));
  console.log(`  · L2 Network: ${l2NetworkName}`);
  console.log(`  · L2 Proxy Admin: ${l2ProxyAdmin}`);
  console.log(`  · L2 Bridge Admin: ${l2BridgeAdmin}`);
  console.log(`  · L2 Deployer: ${l2Deployer.address}`);
  console.log();
  l2DeployScript.print();

  const [, expectedL1TokenBridgeProxyAddress] = await predictAddresses(l1Deployer, 2);
  const [, expectedL2TokenProxyAddress,, expectedL2TokenBridgeProxyAddress] = await predictAddresses(l2Deployer, 4);
  
  const expected_addresses = {
    l1wstETHAddress: l1Token,
    l1BridgeAddress: expectedL1TokenBridgeProxyAddress,
    l2BridgeAddress: expectedL2TokenBridgeProxyAddress,
    l2wstETHAddress: expectedL2TokenProxyAddress,
  }
  console.log(expected_addresses)
  await promptProceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  writeFileSync(`deployed-${l2Network}.json`, JSON.stringify(expected_addresses))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
