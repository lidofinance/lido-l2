import arbitrum from "../../utils/arbitrum";
import env from "../../utils/env";
import network from "../../utils/network";
import prompt from "../../utils/prompt";

async function main() {
  const networkName = env.network();

  const [ethDeployer, arbDeployer] = network
    .multichain(["eth", "arb"], networkName)
    .getSigners(env.privateKey(), { forking: env.forking() });

  const [l1DeployScript, l2DeployScript] = await arbitrum
    .deployment(networkName, { logger: console })
    .gatewayRouterDeployScript(ethDeployer, arbDeployer);

  l1DeployScript.print();
  l2DeployScript.print();
  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
