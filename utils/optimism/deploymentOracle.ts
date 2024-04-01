import { assert } from "chai";
import { Overrides, Wallet } from "ethers";
import { ethers } from "hardhat";
import addresses from "./addresses";
import { CommonOptions } from "./types";
import network, { NetworkName } from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";
import {
    OssifiableProxy__factory,
    TokenRateOracle__factory,
    TokenRateNotifier__factory,
    OpStackTokenRatePusher__factory
  } from "../../typechain";

interface OptDeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface OptDeploymentOptions extends CommonOptions {
  logger?: Logger;
  overrides?: Overrides;
}

export default function deploymentOracle(
    networkName: NetworkName,
    options: OptDeploymentOptions = {}
  ) {
    const optAddresses = addresses(networkName, options);
    return {
      async oracleDeployScript(
        l1Token: string,
        l1Params: OptDeployScriptParams,
        l2Params: OptDeployScriptParams,
      ) {

        const [
          expectedL1TokenRateNotifierImplAddress,
          expectedL1OpStackTokenRatePusherImplAddress,
        ] = await network.predictAddresses(l1Params.deployer, 2);

        const [
          expectedL2TokenRateOracleImplAddress,
          expectedL2TokenRateOracleProxyAddress
        ] = await network.predictAddresses(l2Params.deployer, 2);

        const l1DeployScript = new DeployScript(
          l1Params.deployer,
          options?.logger
        )
          .addStep({
            factory: TokenRateNotifier__factory,
            args: [
              options?.overrides,
            ],
            afterDeploy: (c) =>
              assert.equal(c.address, expectedL1TokenRateNotifierImplAddress),
          })
          .addStep({
            factory: OpStackTokenRatePusher__factory,
            args: [
              optAddresses.L1CrossDomainMessenger,
              l1Token,
              expectedL2TokenRateOracleProxyAddress,
              1000,
              options?.overrides,
            ],
            afterDeploy: (c) =>
              assert.equal(c.address, expectedL1OpStackTokenRatePusherImplAddress),
          });

        const l2DeployScript = new DeployScript(
          l2Params.deployer,
          options?.logger
        )
          .addStep({
              factory: TokenRateOracle__factory,
              args: [
                  optAddresses.L2CrossDomainMessenger,
                  ethers.constants.AddressZero,
                  expectedL1OpStackTokenRatePusherImplAddress,
                  86400,
                  options?.overrides,
              ],
              afterDeploy: (c) =>
                  assert.equal(c.address, expectedL2TokenRateOracleImplAddress),
          })
          .addStep({
            factory: OssifiableProxy__factory,
            args: [
              expectedL2TokenRateOracleImplAddress,
              l2Params.admins.proxy,
              [],
              options?.overrides,
            ],
            afterDeploy: (c) =>
              assert.equal(c.address, expectedL2TokenRateOracleProxyAddress),
          });

        return [l1DeployScript, l2DeployScript];
      },
    };
  }
