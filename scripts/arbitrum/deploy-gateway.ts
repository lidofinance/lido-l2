import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import arbitrum from "../../utils/arbitrum";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";

async function main() {
  const networkName = env.network();
  const [ethDeployer, arbDeployer] = network
    .multichain(["eth", "arb"], networkName)
    .getSigners(env.privateKey(), { forking: env.forking() });

  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await arbitrum
    .deployment(networkName, { logger: console })
    .erc20TokenGatewayDeployScript(
      deploymentConfig.token,
      {
        deployer: ethDeployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: ethDeployer.address,
        },
      },
      {
        deployer: arbDeployer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: arbDeployer.address,
        },
      }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Deploy Arbitrum Gateway",
    ethDeployer,
    arbDeployer,
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
    ethDeployer,
    { logger: console }
  );

  const l2ERC20TokenGatewayProxyDeployStepIndex = 3;
  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.getContractAddress(l2ERC20TokenGatewayProxyDeployStepIndex),
    arbDeployer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.l1);
  await l2BridgingManagement.setup(deploymentConfig.l2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
