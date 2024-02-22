import { assert } from "chai";
import { Overrides, Wallet } from "ethers";
import {
  ERC20Bridged__factory,
  IERC20Metadata__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
} from "../../typechain";

import addresses from "./addresses";
import { CommonOptions } from "./types";
import network, { NetworkName } from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";

interface OptL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface OptL2DeployScriptParams extends OptL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

interface OptDeploymentOptions extends CommonOptions {
  logger?: Logger;
  overrides?: Overrides;
}

export default function deployment(
  networkName: NetworkName,
  options: OptDeploymentOptions = {}
) {
  const optAddresses = addresses(networkName, options);
  return {
    async erc20TokenBridgeDeployScript(
      l1Token: string,
      l1Params: OptL1DeployScriptParams,
      l2Params: OptL2DeployScriptParams
    ) {
      const [
        expectedL1TokenBridgeImplAddress,
        expectedL1TokenBridgeProxyAddress,
      ] = await network.predictAddresses(l1Params.deployer, 2);

      const [
        expectedL2TokenImplAddress,
        expectedL2TokenProxyAddress,
        expectedL2TokenBridgeImplAddress,
        expectedL2TokenBridgeProxyAddress,
      ] = await network.predictAddresses(l2Params.deployer, 4);

      const l1DeployScript = new DeployScript(
        l1Params.deployer,
        options?.logger
      )
        .addStep({
          factory: L1ERC20TokenBridge__factory,
          args: [
            optAddresses.L1CrossDomainMessenger,
            expectedL2TokenBridgeProxyAddress,
            l1Token,
            expectedL2TokenProxyAddress,
            options?.overrides,
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
            options?.overrides,
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
            expectedL2TokenBridgeProxyAddress,
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
          factory: L2ERC20TokenBridge__factory,
          args: [
            optAddresses.L2CrossDomainMessenger,
            expectedL1TokenBridgeProxyAddress,
            l1Token,
            expectedL2TokenProxyAddress,
            options?.overrides,
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
            options?.overrides,
          ],
        });

      return [l1DeployScript, l2DeployScript];
    },
  };
}
