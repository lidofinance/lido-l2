import { Overrides } from "ethers";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";

async function main() {
  const networkName = env.network();
  const [l1Deployer, l2Deployer] = network.getMultiChainSigner(
    "optimism",
    networkName,
    env.privateKey()
  );
  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const overrides: Overrides = { maxPriorityFeePerGas: wei`1.5 gwei` };

  const [l1DeployScript, l2DeployScript] = await optimism
    .deployment(networkName, { logger: console, overrides })
    .erc20TokenBridgeDeployScript(
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
      }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Deploy Optimism Bridge",
    l1Deployer,
    l2Deployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  const l1ERC20TokenBridgeProxyDeployStepIndex = 1;
  const l1BridgingManagement = new BridgingManagement(
    l1DeployScript.getContractAddress(l1ERC20TokenBridgeProxyDeployStepIndex),
    l1Deployer,
    { logger: console }
  );

  const l2ERC20TokenBridgeProxyDeployStepIndex = 3;
  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.getContractAddress(l2ERC20TokenBridgeProxyDeployStepIndex),
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
