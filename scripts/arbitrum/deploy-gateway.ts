import prompt from "../../utils/prompt";
import network from "../../utils/network";
import arbitrum from "../../utils/arbitrum";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";
import env from "../../utils/env";

async function main() {
  const networkName = env.network();
  const [l1Deployer, l2Deployer] = network.getMultiChainSigner(
    "arbitrum",
    networkName,
    env.privateKey()
  );

  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await arbitrum.deployment
    .erc20TokenGateways(networkName)
    .createDeployScripts(
      deploymentConfig.token,
      {
        deployer: l1Deployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: l1Deployer.address,
        },
      },
      {
        deployer: l2Deployer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: l2Deployer.address,
        },
      },
      { logger: console }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Deploy Arbitrum Gateway",
    l1Deployer,
    l2Deployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  const l1ERC20TokenGatewayProxyDeployStepIndex = 1;
  const l1BridgingManagement = new BridgingManagement(
    l1DeployScript.getContractAddress(l1ERC20TokenGatewayProxyDeployStepIndex),
    l1Deployer,
    { logger: console }
  );

  const l2ERC20TokenGatewayProxyDeployStepIndex = 3;
  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.getContractAddress(l2ERC20TokenGatewayProxyDeployStepIndex),
    l2Deployer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.l1);
  await l2BridgingManagement.setup(deploymentConfig.l2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
