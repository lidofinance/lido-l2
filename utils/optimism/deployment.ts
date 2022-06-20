import { assert } from "chai";
import { Wallet } from "ethers";
import {
  ERC20Bridged__factory,
  IERC20Metadata__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import addresses from "./addresses";
import { predictAddresses } from "../deployment/network";
import { DeployScript, Logger } from "../deployment/DeployScript";

interface OptimismCommonDependencies {
  messenger: string;
}

interface OptimismL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface OptimismL2DeployScriptParams extends OptimismL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

export async function createOptimismBridgeDeployScripts(
  l1Token: string,
  l1Params: OptimismL1DeployScriptParams,
  l2Params: OptimismL2DeployScriptParams,
  options?: {
    dependencies?: {
      l1?: Partial<OptimismCommonDependencies>;
      l2?: Partial<OptimismCommonDependencies>;
    };
    logger?: Logger;
  }
) {
  const l1Dependencies = {
    ...addresses.getL1(await l1Params.deployer.getChainId()),
    ...options?.dependencies?.l1,
  };
  const l2Dependencies = {
    ...addresses.getL2(await l2Params.deployer.getChainId()),
    ...options?.dependencies?.l2,
  };

  const [expectedL1TokenBridgeImplAddress, expectedL1TokenBridgeProxyAddress] =
    await predictAddresses(l1Params.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokenBridgeImplAddress,
    expectedL2TokenBridgeProxyAddress,
  ] = await predictAddresses(l2Params.deployer, 4);

  const l1DeployScript = new DeployScript(l1Params.deployer, options?.logger)
    .addStep({
      factory: L1ERC20TokenBridge__factory,
      args: [
        l1Dependencies.messenger,
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
        l1Params.admins.proxy,
        L1ERC20TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [l1Params.admins.bridge]
        ),
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokenBridgeProxyAddress),
    });

  const l1TokenInfo = IERC20Metadata__factory.connect(
    l1Token,
    l1Params.deployer
  );

  const [decimals, l2TokenName, l2TokenSymbol] = await Promise.all([
    l1TokenInfo.decimals(),
    l2Params.l2Token?.name ?? l1TokenInfo.name(),
    l2Params.l2Token?.symbol ?? l1TokenInfo.symbol(),
  ]);

  const l2DeployScript = new DeployScript(l2Params.deployer, options?.logger)
    .addStep({
      factory: ERC20Bridged__factory,
      args: [
        l2TokenName,
        l2TokenSymbol,
        decimals,
        expectedL2TokenBridgeProxyAddress,
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenImplAddress,
        l2Params.admins.proxy,
        ERC20Bridged__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2TokenName, l2TokenSymbol]
        ),
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenProxyAddress),
    })
    .addStep({
      factory: L2ERC20TokenBridge__factory,
      args: [
        l2Dependencies.messenger,
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
        l2Params.admins.proxy,
        L2ERC20TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2Params.admins.bridge]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

export default { createOptimismBridgeDeployScripts };
