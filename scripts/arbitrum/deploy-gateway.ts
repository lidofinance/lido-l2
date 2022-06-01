import hre from "hardhat";
import { assert } from "chai";
import { Contract } from "ethers";
import {
  ERC20Ownable__factory,
  L1TokensGateway__factory,
  L2TokensGateway__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  DeploymentNetwork,
  getDeploymentNetwork,
  predictAddresses,
} from "../../utils/deployment/network";
import {
  ArbitrumDeploymentDependencies,
  loadArbitrumDeployDependencies,
} from "../../utils/deployment/dependencies";
import { DeployScript } from "../../utils/deployment/DeployScript";
import { promptProceed } from "../../utils/prompt";
import chalk from "chalk";

const L1TOKEN = "0xB9a4859Ba62d7580b68a6395B0703e869A55d62C";

// Use below constant to provide dependencies manually
// const manualDependencies = {
//   l1: {
//     inbox: "",
//     router: "",
//   },
//   l2: {
//     arbSys: "",
//     router: "",
//   },
// };

async function main() {
  const network = getDeploymentNetwork(hre);
  const dependencies = await loadArbitrumDeployDependencies(network);

  const [l1DeployScript, l2DeployScript] =
    await createArbitrumGatewayDeployScripts(network, dependencies, L1TOKEN);

  console.log(chalk.bold("L1 Gateway Deployment Script:"));
  l1DeployScript.print();
  console.log(chalk.bold("L2 Gateway Deployment Script:"));
  l2DeployScript.print();

  await promptProceed();

  await l1DeployScript.run();
  await l2DeployScript.run();
}

async function createArbitrumGatewayDeployScripts(
  networkConfig: DeploymentNetwork,
  dependencies: ArbitrumDeploymentDependencies,
  l1Token: string
) {
  const [
    expectedL1TokensGatewayImplAddress,
    expectedL1TokensGatewayProxyAddress,
  ] = await predictAddresses(networkConfig.l1.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokensGatewayImplAddress,
    expectedL2TokensGatewayProxyAddress,
  ] = await predictAddresses(networkConfig.l2.deployer, 4);

  const createAddressValidator =
    (expectedAddress: string) => (contract: Contract) =>
      assert.equal(contract.address, expectedAddress);

  const l1DeployScenario = new DeployScript(networkConfig.l1.deployer)
    .addStep({
      factory: L1TokensGateway__factory,
      args: [
        dependencies.l1.inbox,
        dependencies.l1.router,
        expectedL2TokensGatewayProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: createAddressValidator(expectedL1TokensGatewayImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL1TokensGatewayImplAddress,
        networkConfig.l1.deployer.address,
        L1TokensGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [networkConfig.l1.deployer.address]
        ),
      ],
      afterDeploy: createAddressValidator(expectedL1TokensGatewayProxyAddress),
    });

  const l2DeployScenario = new DeployScript(networkConfig.l2.deployer)
    .addStep({
      factory: ERC20Ownable__factory,
      args: [
        "L2 Token Name",
        "L2 Token Symbol",
        18,
        expectedL2TokensGatewayProxyAddress,
      ],
      afterDeploy: createAddressValidator(expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenImplAddress,
        networkConfig.l2.deployer.address,
        "0x",
      ],
      afterDeploy: createAddressValidator(expectedL2TokenProxyAddress),
    })
    .addStep({
      factory: L2TokensGateway__factory,
      args: [
        dependencies.l2.arbSys,
        dependencies.l2.router,
        expectedL1TokensGatewayProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: createAddressValidator(expectedL2TokensGatewayImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokensGatewayImplAddress,
        networkConfig.l2.deployer.address,
        L2TokensGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [networkConfig.l2.deployer.address]
        ),
      ],
    });

  return [l1DeployScenario, l2DeployScenario];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
