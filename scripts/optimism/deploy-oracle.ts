import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import deploymentOracle from "../../utils/deployment";
import { TokenRateNotifier__factory } from "../../typechain";

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

  const l1Token = env.address("TOKEN")
  const l1Admin = env.address("L1_PROXY_ADMIN");
  const l2Admin = env.address("L2_PROXY_ADMIN");

  const [l1DeployScript, l2DeployScript] = await optimism
    .deploymentOracle(networkName, { logger: console })
    .oracleDeployScript(
      l1Token,
      {
        deployer: ethDeployer,
        admins: {
          proxy: l1Admin,
          bridge: ethDeployer.address,
        },
      },
      {
        deployer: optDeployer,
        admins: {
          proxy: l2Admin,
          bridge: optDeployer.address,
        },
      }
    );

//   await deploymentOracle.printMultiChainDeploymentConfig(
//     "Deploy Token Rate Oracle",
//     ethDeployer,
//     optDeployer,
//     deploymentConfig,
//     l1DeployScript,
//     l2DeployScript
//   );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  /// setup, add observer
  const tokenRateNotifier = TokenRateNotifier__factory.connect(
    l1DeployScript.tokenRateNotifierImplAddress,
    ethDeployer
  );
  await tokenRateNotifier
    .connect(ethDeployer)
    .addObserver(l1DeployScript.opStackTokenRatePusherImplAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
