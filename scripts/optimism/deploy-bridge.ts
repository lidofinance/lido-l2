import interchain from "../../utils/interchain";
import { promptProceed } from "../../utils/prompt";
import optimism from "../../utils/optimism";

async function main() {
  const params = interchain.loadDeploymentParams();

  const [l1DeployScript, l2DeployScript] =
    await optimism.deployment.createOptimismBridgeDeployScripts(
      params.token,
      {
        deployer: params.l1.deployer,
        admins: {
          proxy: params.l1.proxyAdmin,
          bridge: params.l1.deployer.address,
        },
      },
      {
        deployer: params.l2.deployer,
        admins: {
          proxy: params.l2.proxyAdmin,
          bridge: params.l2.deployer.address,
        },
      },
      { logger: console }
    );

  interchain.printDeploymentInfo(
    "Deploy Optimism Bridge",
    params,
    l1DeployScript,
    l2DeployScript
  );

  await promptProceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  await interchain.setupBridgingManager(
    l1DeployScript.getContractAddress(1),
    params.l1,
    { title: "Setup Optimism L1 Bridge", logger: console }
  );

  await interchain.setupBridgingManager(
    l2DeployScript.getContractAddress(3),
    params.l2,
    { title: "Setup Optimism L2 Bridge", logger: console }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
