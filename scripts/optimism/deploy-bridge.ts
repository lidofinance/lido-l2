import { assert } from "chai";
import chalk from "chalk";
import hre from "hardhat";
import {
  ERC20Ownable__factory,
  L1TokenBridge__factory,
  L2TokensBridge__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  loadOptimismDeployDependencies,
  OptimismDeploymentDependencies,
} from "../../utils/deployment/dependencies";
import { DeployScript } from "../../utils/deployment/DeployScript";
import {
  DeploymentNetwork,
  getDeploymentNetwork,
  predictAddresses,
} from "../../utils/deployment/network";
import { promptProceed } from "../../utils/prompt";

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

async function createOptimismBridgeDeployScripts(
  network: DeploymentNetwork,
  dependencies: OptimismDeploymentDependencies,
  l1Token: string
) {
  const [expectedL1TokenBridgeImplAddress, expectedL1TokenBridgeProxyAddress] =
    await predictAddresses(network.l1.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokenBridgeImplAddress,
    expectedL2TokenBridgeProxyAddress,
  ] = await predictAddresses(network.l2.deployer, 4);

  const l1DeployScript = new DeployScript(network.l1.deployer)
    .addStep({
      factory: L1TokenBridge__factory,
      args: [
        dependencies.l1.messenger,
        expectedL1TokenBridgeProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokenBridgeImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL1TokenBridgeImplAddress,
        network.l1.deployer.address,
        L1TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [network.l1.deployer.address]
        ),
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokenBridgeProxyAddress),
    });

  const l2DeployScript = new DeployScript(network.l2.deployer)
    .addStep({
      factory: ERC20Ownable__factory,
      args: [
        "L2 Token Name",
        "L2 Token Symbol",
        18,
        expectedL2TokenBridgeProxyAddress,
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [expectedL2TokenImplAddress, network.l2.deployer.address, "0x"],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenProxyAddress),
    })
    .addStep({
      factory: L2TokensBridge__factory,
      args: [
        dependencies.l2.messenger,
        expectedL1TokenBridgeProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL2TokenBridgeImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenBridgeImplAddress,
        network.l2.deployer.address,
        L2TokensBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [network.l2.deployer.address]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
