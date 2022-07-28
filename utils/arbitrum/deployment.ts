import { assert } from "chai";
import { ethers } from "hardhat";
import { Overrides, Wallet } from "ethers";
import {
  ERC20Bridged__factory,
  IERC20Metadata__factory,
  L1ERC20TokenGateway__factory,
  L1GatewayRouter__factory,
  L2ERC20TokenGateway__factory,
  L2GatewayRouter__factory,
  OssifiableProxy__factory,
} from "../../typechain";

import addresses from "./addresses";
import { CommonOptions } from "./types";
import network, { NetworkName } from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";

interface ArbL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface ArbL2DeployScriptParams extends ArbL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

interface ArbDeploymentOptions extends CommonOptions {
  logger?: Logger;
  overrides?: Overrides;
}

export default function deployment(
  networkName: NetworkName,
  options: ArbDeploymentOptions = {}
) {
  const arbAddresses = addresses(networkName, options);

  return {
    async erc20TokenGatewayDeployScript(
      l1Token: string,
      l1Params: ArbL1DeployScriptParams,
      l2Params: ArbL2DeployScriptParams
    ) {
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

      const l1DeployScript = new DeployScript(
        l1Params.deployer,
        options?.logger
      )
        .addStep({
          factory: L1ERC20TokenGateway__factory,
          args: [
            arbAddresses.Inbox,
            arbAddresses.L1GatewayRouter,
            expectedL2TokensGatewayProxyAddress,
            l1Token,
            expectedL2TokenProxyAddress,
            options?.overrides,
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
            options?.overrides,
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

      const l2DeployScript = new DeployScript(
        l2Params.deployer,
        options?.logger
      )
        .addStep({
          factory: ERC20Bridged__factory,
          args: [
            l2TokenName,
            l2TokenSymbol,
            decimals,
            expectedL2TokensGatewayProxyAddress,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenImplAddress),
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
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenProxyAddress),
        })
        .addStep({
          factory: L2ERC20TokenGateway__factory,
          args: [
            arbAddresses.ArbSys,
            arbAddresses.L2GatewayRouter,
            expectedL1TokensGatewayProxyAddress,
            l1Token,
            expectedL2TokenProxyAddress,
            options?.overrides,
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
            options?.overrides,
          ],
        });

      return [l1DeployScript, l2DeployScript];
    },
    async gatewayRouterDeployScript(l1Deployer: Wallet, l2Deployer: Wallet) {
      const [expectedL1GatewayRouter] = await network.predictAddresses(
        l1Deployer,
        1
      );
      const [expectedL2GatewayRouter] = await network.predictAddresses(
        l2Deployer,
        1
      );

      const l1DeployScript = new DeployScript(
        l1Deployer,
        options?.logger
      ).addStep({
        factory: L1GatewayRouter__factory,
        args: [options?.overrides],
        afterDeploy: async (l1GatewayRouter) => {
          assert.equal(l1GatewayRouter.address, expectedL1GatewayRouter);
          await l1GatewayRouter.initialize(
            l1Deployer.address,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            expectedL2GatewayRouter,
            arbAddresses.Inbox
          );
        },
      });

      const l2DeployScript = new DeployScript(
        l2Deployer,
        options?.logger
      ).addStep({
        factory: L2GatewayRouter__factory,
        args: [options?.overrides],
        afterDeploy: async (l2GatewayRouter) => {
          assert.equal(l2GatewayRouter.address, expectedL2GatewayRouter);
          await l2GatewayRouter.initialize(
            expectedL1GatewayRouter,
            ethers.constants.AddressZero
          );
        },
      });
      return [l1DeployScript, l2DeployScript];
    },
  };
}
