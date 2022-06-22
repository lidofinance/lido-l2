import { assert } from "chai";
import { Wallet } from "ethers";
import {
  ERC20Bridged__factory,
  IERC20Metadata__factory,
  L1ERC20TokenGateway__factory,
  L1GatewayRouter__factory,
  L2ERC20TokenGateway__factory,
  L2GatewayRouter__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import addresses, {
  ArbitrumL1Addresses,
  ArbitrumL2Addresses,
} from "./addresses";
import network from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";
import { ethers } from "hardhat";

interface ArbitrumL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface ArbitrumL2DeployScriptParams extends ArbitrumL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

export async function createGatewayDeployScripts(
  l1Token: string,
  l1Params: ArbitrumL1DeployScriptParams,
  l2Params: ArbitrumL2DeployScriptParams,
  options?: {
    dependencies?: {
      l1?: Partial<ArbitrumL1Addresses>;
      l2?: Partial<ArbitrumL2Addresses>;
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

  const [
    expectedL1TokensGatewayImplAddress,
    expectedL1TokensGatewayProxyAddress,
  ] = await network.predictAddresses(l1Params.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokensGatewayImplAddress,
    expectedL2TokensGatewayProxyAddress,
  ] = await network.predictAddresses(l2Params.deployer, 4);

  const l1DeployScript = new DeployScript(l1Params.deployer, options?.logger)
    .addStep({
      factory: L1ERC20TokenGateway__factory,
      args: [
        l1Dependencies.inbox,
        l1Dependencies.l1GatewayRouter,
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
        l1Params.admins.proxy,
        L1ERC20TokenGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [l1Params.admins.bridge]
        ),
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokensGatewayProxyAddress),
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
        expectedL2TokensGatewayProxyAddress,
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
      factory: L2ERC20TokenGateway__factory,
      args: [
        l2Dependencies.arbSys,
        l2Dependencies.l2GatewayRouter,
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
        l2Params.admins.proxy,
        L2ERC20TokenGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2Params.admins.bridge]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

async function createRoutersDeployScript(
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  options: { logger?: Logger } = {}
) {
  const l1ChainId = await l1Deployer.getChainId();
  const [expectedL1GatewayRouter] = await network.predictAddresses(
    l1Deployer,
    1
  );
  const [expectedL2GatewayRouter] = await network.predictAddresses(
    l2Deployer,
    1
  );

  const l1DeployScript = new DeployScript(l1Deployer, options?.logger).addStep({
    factory: L1GatewayRouter__factory,
    args: [],
    afterDeploy: async (l1GatewayRouter) => {
      assert.equal(l1GatewayRouter.address, expectedL1GatewayRouter);
      await l1GatewayRouter.initialize(
        l1Deployer.address,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        expectedL2GatewayRouter,
        addresses.getL1(l1ChainId).inbox
      );
    },
  });

  const l2DeployScript = new DeployScript(l2Deployer, options?.logger).addStep({
    factory: L2GatewayRouter__factory,
    args: [],
    afterDeploy: async (l2GatewayRouter) => {
      assert.equal(l2GatewayRouter.address, expectedL2GatewayRouter);
      await l2GatewayRouter.initialize(
        expectedL1GatewayRouter,
        ethers.constants.AddressZero
      );
    },
  });
  return [l1DeployScript, l2DeployScript];
}

export default { createGatewayDeployScripts, createRoutersDeployScript };
