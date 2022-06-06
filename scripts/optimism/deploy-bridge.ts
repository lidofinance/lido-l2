import chalk from "chalk";
import hre from "hardhat";
import { loadOptimismDeployDependencies } from "../../utils/deployment/dependencies";
import { getDeploymentNetwork } from "../../utils/deployment/network";
import { promptProceed } from "../../utils/prompt";
import { createOptimismBridgeDeployScripts } from "../../utils/deployment/script-factories";
const L1TOKEN = "0xB9a4859Ba62d7580b68a6395B0703e869A55d62C";

async function main() {
  const network = getDeploymentNetwork(hre);
  const dependencies = await loadOptimismDeployDependencies(network);

  const [l1DeployScript, l2DeployScript] =
    await createOptimismBridgeDeployScripts(network, dependencies, L1TOKEN);

  console.log(chalk.bold("L1 Gateway Deployment Script:"));
  l1DeployScript.print();
  console.log(chalk.bold("L2 Gateway Deployment Script:"));
  l2DeployScript.print();

  await promptProceed();

  await l1DeployScript.run();
  await l2DeployScript.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
