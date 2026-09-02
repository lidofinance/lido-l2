import { assert } from "chai";
import { BigNumber, Wallet } from "ethers";
import { OptDeploymentOptions, DeployScriptParams } from "./types";
import network from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";
import {
  ERC20BridgedPermit__factory,
  ERC20RebasableBridgedPermit__factory,
  L1LidoTokensBridge__factory,
  L2ERC20ExtendedTokensBridge__factory,
  OssifiableProxy__factory,
  TokenRateOracle__factory,
  OpStackTokenRatePusher__factory,
  TokenRateNotifier__factory,
  IERC20Metadata__factory
} from "../../typechain";

interface OptL1DeployScriptParams extends DeployScriptParams {
  l1CrossDomainMessenger: string;
  l1TokenNonRebasable: string;
  l1TokenRebasable: string;
  accountingOracle: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  lido?: string;
  tokenRateNotifierOwner?: string;
}

interface OptL2DeployScriptParams extends DeployScriptParams {
  l2CrossDomainMessenger: string;
  l2TokenNonRebasable: {
    name?: string;
    symbol?: string;
    version: string;
    decimals?: number;
  };
  l2TokenRebasable: {
    name?: string;
    symbol?: string;
    version: string;
    decimals?: number;
  };
  tokenRateOracle: {
    admin: string;
    tokenRateOutdatedDelay: BigNumber;
    maxAllowedL2ToL1ClockLag: BigNumber;
    maxAllowedTokenRateDeviationPerDayBp: BigNumber;
    oldestRateAllowedInPauseTimeSpan: BigNumber;
    minTimeBetweenTokenRateUpdates: BigNumber;
    tokenRate: BigNumber;
    l1Timestamp: BigNumber;
  },
}

export class L1DeployAllScript extends DeployScript {
  constructor(
    deployer: Wallet,
    bridgeImplAddress: string,
    bridgeProxyAddress: string,
    opStackTokenRatePusherImplAddress: string,
    tokenRateNotifierImplAddress?: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.bridgeImplAddress = bridgeImplAddress;
    this.bridgeProxyAddress = bridgeProxyAddress;
    this.tokenRateNotifierImplAddress = tokenRateNotifierImplAddress;
    this.opStackTokenRatePusherImplAddress = opStackTokenRatePusherImplAddress;
  }

  public bridgeImplAddress: string;
  public bridgeProxyAddress: string;
  public tokenRateNotifierImplAddress?: string;
  public opStackTokenRatePusherImplAddress: string;
}

export class L2DeployAllScript extends DeployScript {

  constructor(
    deployer: Wallet,
    tokenImplAddress: string,
    tokenProxyAddress: string,
    tokenRebasableImplAddress: string,
    tokenRebasableProxyAddress: string,
    tokenBridgeImplAddress: string,
    tokenBridgeProxyAddress: string,
    tokenRateOracleImplAddress: string,
    tokenRateOracleProxyAddress: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.tokenImplAddress = tokenImplAddress;
    this.tokenProxyAddress = tokenProxyAddress;
    this.tokenRebasableImplAddress = tokenRebasableImplAddress;
    this.tokenRebasableProxyAddress = tokenRebasableProxyAddress;
    this.tokenBridgeImplAddress = tokenBridgeImplAddress;
    this.tokenBridgeProxyAddress = tokenBridgeProxyAddress;
    this.tokenRateOracleImplAddress = tokenRateOracleImplAddress;
    this.tokenRateOracleProxyAddress = tokenRateOracleProxyAddress;
  }

  public tokenImplAddress: string;
  public tokenProxyAddress: string;
  public tokenRebasableImplAddress: string;
  public tokenRebasableProxyAddress: string;
  public tokenBridgeImplAddress: string;
  public tokenBridgeProxyAddress: string;
  public tokenRateOracleImplAddress: string;
  public tokenRateOracleProxyAddress: string;
}

async function predictAllAddresses(l1Params: OptL1DeployScriptParams, l2Params: OptL2DeployScriptParams, deployNotifier: boolean) {
  const [
    l1TokenBridgeImpl,
    l1TokenBridgeProxy,
    l1OpStackTokenRatePusherImpl,
    l1TokenRateNotifierImpl
  ] = await network.predictAddresses(l1Params.deployer, l1Params.deployOffset + 3 + (deployNotifier ? 1 : 0));

  const [
    l2TokenRateOracleImpl,
    l2TokenRateOracleProxy,
    l2TokenImpl,
    l2TokenProxy,
    l2TokenRebasableImpl,
    l2TokenRebasableProxy,
    l2TokenBridgeImpl,
    l2TokenBridgeProxy
  ] = await network.predictAddresses(l2Params.deployer, l2Params.deployOffset + 8);

  return {
    l1TokenBridgeImpl,
    l1TokenBridgeProxy,
    l1OpStackTokenRatePusherImpl,
    l1TokenRateNotifierImpl,
    l2TokenRateOracleImpl,
    l2TokenRateOracleProxy,
    l2TokenImpl,
    l2TokenProxy,
    l2TokenRebasableImpl,
    l2TokenRebasableProxy,
    l2TokenBridgeImpl,
    l2TokenBridgeProxy
  };
}

/// Deploy all contracts on new network from scratch.
export default function deployAll(
  deployNotifier: boolean,
  options: OptDeploymentOptions = {}
) {
  return {
    async deployAllScript(
      l1Params: OptL1DeployScriptParams,
      l2Params: OptL2DeployScriptParams,
    ): Promise<[L1DeployAllScript, L2DeployAllScript]> {
      let predictedAddresses = await predictAllAddresses(l1Params, l2Params, deployNotifier);
      let numClashedAddresses = Object.keys(predictedAddresses).length - new Set(Object.values(predictedAddresses)).size;

      // Burning enough nonces on L2 side
      while (numClashedAddresses > 0) {
        console.log(`NB: Num of clashed predicted addresses on L1 and L2: ${numClashedAddresses}. Burning ${numClashedAddresses} nonces on L2 side...`);
        for (let i = 0; i < numClashedAddresses; i++) {
          const tx = await l2Params.deployer.sendTransaction({
            to: l2Params.deployer.address,
            value: 0
          });
          await tx.wait()
        }
        predictedAddresses = await predictAllAddresses(l1Params, l2Params, deployNotifier);
        numClashedAddresses = Object.keys(predictedAddresses).length - new Set(Object.values(predictedAddresses)).size;
      }

      const l1DeployScript = new L1DeployAllScript(
        l1Params.deployer,
        predictedAddresses.l1TokenBridgeImpl,
        predictedAddresses.l1TokenBridgeProxy,
        predictedAddresses.l1OpStackTokenRatePusherImpl,
        predictedAddresses.l1TokenRateNotifierImpl,
        options?.logger
      )
        .addStep({
          factory: L1LidoTokensBridge__factory,
          args: [
            l1Params.l1CrossDomainMessenger,
            predictedAddresses.l2TokenBridgeProxy,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            predictedAddresses.l2TokenProxy,
            predictedAddresses.l2TokenRebasableProxy,
            l1Params.accountingOracle,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l1TokenBridgeImpl),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            predictedAddresses.l1TokenBridgeImpl,
            l1Params.admins.proxy,
            L1LidoTokensBridge__factory.createInterface().encodeFunctionData(
              "initialize",
              [l1Params.admins.bridge]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l1TokenBridgeProxy),
        })
        .addStep({
          factory: OpStackTokenRatePusher__factory,
          args: [
            l1Params.l1CrossDomainMessenger,
            l1Params.l1TokenNonRebasable,
            l1Params.accountingOracle,
            predictedAddresses.l2TokenRateOracleProxy,
            l1Params.l2GasLimitForPushingTokenRate,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l1OpStackTokenRatePusherImpl),
        });

      if (deployNotifier && l1Params.tokenRateNotifierOwner && l1Params.lido) {
        l1DeployScript.addStep({
          factory: TokenRateNotifier__factory,
          args: [
            l1Params.tokenRateNotifierOwner,
            l1Params.lido,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l1TokenRateNotifierImpl),
        })
      }

      const l1TokenNonRebasableInfo = IERC20Metadata__factory.connect(
        l1Params.l1TokenNonRebasable,
        l1Params.deployer
      );

      const l1TokenRebasableInfo = IERC20Metadata__factory.connect(
        l1Params.l1TokenRebasable,
        l1Params.deployer
      );

      const [
        l2TokenNonRebasableDecimals, l2TokenNonRebasableName, l2TokenNonRebasableSymbol,
        l2TokenRebasableDecimals, l2TokenRebasableName, l2TokenRebasableSymbol
      ] = await Promise.all([
        l1TokenNonRebasableInfo.decimals(),
        l2Params.l2TokenNonRebasable?.name ?? l1TokenNonRebasableInfo.name(),
        l2Params.l2TokenNonRebasable?.symbol ?? l1TokenNonRebasableInfo.symbol(),
        l1TokenRebasableInfo.decimals(),
        l2Params.l2TokenRebasable?.name ?? l1TokenRebasableInfo.name(),
        l2Params.l2TokenRebasable?.symbol ?? l1TokenRebasableInfo.symbol(),
      ]);

      const l2DeployScript = new L2DeployAllScript(
        l2Params.deployer,
        predictedAddresses.l2TokenImpl,
        predictedAddresses.l2TokenProxy,
        predictedAddresses.l2TokenRebasableImpl,
        predictedAddresses.l2TokenRebasableProxy,
        predictedAddresses.l2TokenBridgeImpl,
        predictedAddresses.l2TokenBridgeProxy,
        predictedAddresses.l2TokenRateOracleImpl,
        predictedAddresses.l2TokenRateOracleProxy,
        options?.logger
      )
        .addStep({
          factory: TokenRateOracle__factory,
          args: [
            l2Params.l2CrossDomainMessenger,
            predictedAddresses.l2TokenBridgeProxy,
            predictedAddresses.l1OpStackTokenRatePusherImpl,
            l2Params.tokenRateOracle.tokenRateOutdatedDelay,
            l2Params.tokenRateOracle.maxAllowedL2ToL1ClockLag,
            l2Params.tokenRateOracle.maxAllowedTokenRateDeviationPerDayBp,
            l2Params.tokenRateOracle.oldestRateAllowedInPauseTimeSpan,
            l2Params.tokenRateOracle.minTimeBetweenTokenRateUpdates,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenRateOracleImpl),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            predictedAddresses.l2TokenRateOracleImpl,
            l2Params.admins.proxy,
            TokenRateOracle__factory.createInterface().encodeFunctionData(
              "initialize",
              [
                l2Params.tokenRateOracle.admin,
                l2Params.tokenRateOracle.tokenRate,
                l2Params.tokenRateOracle.l1Timestamp
              ]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenRateOracleProxy),
        })
        .addStep({
          factory: ERC20BridgedPermit__factory,
          args: [
            l2TokenNonRebasableName,
            l2TokenNonRebasableSymbol,
            l2Params.l2TokenNonRebasable.version,
            l2TokenNonRebasableDecimals,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenImpl),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            predictedAddresses.l2TokenImpl,
            l2Params.admins.proxy,
            ERC20BridgedPermit__factory.createInterface().encodeFunctionData(
              "initialize",
              [
                l2TokenNonRebasableName,
                l2TokenNonRebasableSymbol,
                l2Params.l2TokenNonRebasable.version
              ]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenProxy),
        })
        .addStep({
          factory: ERC20RebasableBridgedPermit__factory,
          args: [
            l2TokenRebasableName,
            l2TokenRebasableSymbol,
            l2Params.l2TokenRebasable.version,
            l2TokenRebasableDecimals,
            predictedAddresses.l2TokenProxy,
            predictedAddresses.l2TokenRateOracleProxy,
            predictedAddresses.l2TokenBridgeProxy,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenRebasableImpl),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            predictedAddresses.l2TokenRebasableImpl,
            l2Params.admins.proxy,
            ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData(
              "initialize",
              [
                l2TokenRebasableName,
                l2TokenRebasableSymbol,
                l2Params.l2TokenRebasable.version
              ]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenRebasableProxy),
        })
        .addStep({
          factory: L2ERC20ExtendedTokensBridge__factory,
          args: [
            l2Params.l2CrossDomainMessenger,
            predictedAddresses.l1TokenBridgeProxy,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            predictedAddresses.l2TokenProxy,
            predictedAddresses.l2TokenRebasableProxy,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, predictedAddresses.l2TokenBridgeImpl),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            predictedAddresses.l2TokenBridgeImpl,
            l2Params.admins.proxy,
            L2ERC20ExtendedTokensBridge__factory.createInterface().encodeFunctionData(
              "initialize",
              [l2Params.admins.bridge]
            ),
            options?.overrides,
          ],
        });

      return [l1DeployScript as L1DeployAllScript, l2DeployScript as L2DeployAllScript];
    },
  };
}
