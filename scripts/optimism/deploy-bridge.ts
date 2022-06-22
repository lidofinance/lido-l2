import prompt from "../../utils/prompt";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";

async function main() {
  const networkConfig = network.getMultichainNetwork("optimism");
  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] =
    await optimism.deployment.createOptimismBridgeDeployScripts(
      deploymentConfig.token,
      {
        deployer: networkConfig.l1.signer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: networkConfig.l1.signer.address,
        },
      },
      {
        deployer: networkConfig.l2.signer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: networkConfig.l2.signer.address,
        },
      },
      { logger: console }
    );

  deployment.printMultiChainDeploymentConfig(
    "Deploy Optimism Bridge",
    networkConfig,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  const l1BridgingManagement = new BridgingManagement(
    l1DeployScript.getContractAddress(1),
    networkConfig.l1.signer,
    { logger: console }
  );

  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.getContractAddress(3),
    networkConfig.l2.signer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.l1);
  await l2BridgingManagement.setup(deploymentConfig.l2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
