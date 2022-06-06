import { assert } from "chai";
import {
  ERC20Ownable__factory,
  L1TokenBridge__factory,
  L1TokensGateway__factory,
  L2TokenBridge__factory,
  L2TokensGateway__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  OptimismDeploymentDependencies,
  ArbitrumDeploymentDependencies,
} from "../../utils/deployment/dependencies";
import { DeployScript } from "../../utils/deployment/DeployScript";
import {
  DeploymentNetwork,
  predictAddresses,
} from "../../utils/deployment/network";

export async function createOptimismBridgeDeployScripts(
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
        expectedL2TokenBridgeProxyAddress,
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
      factory: L2TokenBridge__factory,
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
        L2TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [network.l2.deployer.address]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

export async function createArbitrumGatewayDeployScripts(
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
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokensGatewayImplAddress),
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
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokensGatewayProxyAddress),
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
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenImplAddress,
        networkConfig.l2.deployer.address,
        "0x",
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenProxyAddress),
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
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL2TokensGatewayImplAddress),
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
