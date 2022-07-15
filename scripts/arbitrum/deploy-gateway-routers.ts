import arbitrum from "../../utils/arbitrum";
import env from "../../utils/env";
import network from "../../utils/network";
import prompt from "../../utils/prompt";

async function main() {
  const networkName = env.network();
  const networkConfig = network.getMultichainNetwork("arbitrum");
  const [l1DeployScript, l2DeployScript] = await arbitrum.deployment
    .gatewayRouters(networkName)
    .createDeployScripts(networkConfig.l1.signer, networkConfig.l2.signer, {
      logger: console,
    });

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
