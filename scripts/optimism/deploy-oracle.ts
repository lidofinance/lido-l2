import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import deploymentOracle from "../../utils/deployment";

async function main() {
  const networkName = env.network();
  const ethOptNetwork = network.multichain(["eth", "opt"], networkName);

  const [ethDeployer] = ethOptNetwork.getSigners(env.privateKey(), {
    forking: env.forking(),
  });
  const [, optDeployer] = ethOptNetwork.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking(),
    }
  );

  const deploymentConfig = deploymentOracle.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await optimism
    .deploymentOracle(networkName, { logger: console })
    .oracleDeployScript(
      deploymentConfig.token,
      {
        deployer: ethDeployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: ethDeployer.address,
        },
      },
      {
        deployer: optDeployer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: optDeployer.address,
        },
      }
    );

  await deploymentOracle.printMultiChainDeploymentConfig(
    "Deploy Optimism Bridge",
    ethDeployer,
    optDeployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
