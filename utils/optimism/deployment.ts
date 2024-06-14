import { assert } from "chai";
import { BigNumber, Wallet } from "ethers";
import addresses from "./addresses";
import { OptDeploymentOptions, DeployScriptParams } from "./types";
import network, { NetworkName } from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";
import {
  ERC20BridgedPermit__factory,
  ERC20RebasableBridgedPermit__factory,
  L1LidoTokensBridge__factory,
  L2ERC20ExtendedTokensBridge__factory,
  OssifiableProxy__factory,
  TokenRateOracle__factory,
  TokenRateNotifier__factory,
  OpStackTokenRatePusher__factory,
  IERC20Metadata__factory
} from "../../typechain";

interface OptL1DeployScriptParams extends DeployScriptParams {
  l1TokenNonRebasable: string;
  l1TokenRebasable: string;
  accountingOracle: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  l1AuthorizedRebaseCaller: string;
}

interface OptL2DeployScriptParams extends DeployScriptParams {
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
    tokenRateOutdatedDelay: BigNumber;
    maxAllowedL2ToL1ClockLag: BigNumber;
    maxAllowedTokenRateDeviationPerDayBp: BigNumber;
    oldestRateAllowedInPauseTimeSpan: BigNumber;
    maxAllowedTimeBetweenTokenRateUpdates: BigNumber;
    tokenRate: BigNumber;
    l1Timestamp: BigNumber;
  }
}

export class L1DeployAllScript extends DeployScript {

  constructor(
    deployer: Wallet,
    bridgeImplAddress: string,
    bridgeProxyAddress: string,
    tokenRateNotifierImplAddress: string,
    opStackTokenRatePusherImplAddress: string,
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
  public tokenRateNotifierImplAddress: string;
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

/// Deploy all from scratch
/// L1 part
///     L1LidoTokensBridge + Proxy
///     TokenRateNotifier
///     OpStackTokenRatePusher
/// L2 part
///      TokenRateOracle + Proxy
///      ERC20BridgedPermit + Proxy
///      ERC20RebasableBridgedPermit + Proxy
///      L2ERC20ExtendedTokensBridge + Proxy
export default function deploymentAll(
  networkName: NetworkName,
  options: OptDeploymentOptions = {}
) {
  const optAddresses = addresses(networkName, options);
  return {
    async deployAllScript(
      l1Params: OptL1DeployScriptParams,
      l2Params: OptL2DeployScriptParams,
    ): Promise<[L1DeployAllScript, L2DeployAllScript]> {

      const [
        expectedL1TokenBridgeImplAddress,
        expectedL1TokenBridgeProxyAddress,
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
      ] = await network.predictAddresses(l1Params.deployer, l1Params.contractsShift + 4);

      const [
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress,
        expectedL2TokenImplAddress,
        expectedL2TokenProxyAddress,
        expectedL2TokenRebasableImplAddress,
        expectedL2TokenRebasableProxyAddress,
        expectedL2TokenBridgeImplAddress,
        expectedL2TokenBridgeProxyAddress
      ] = await network.predictAddresses(l2Params.deployer, l2Params.contractsShift + 8);

      const l1DeployScript = new L1DeployAllScript(
        l1Params.deployer,
        expectedL1TokenBridgeImplAddress,
        expectedL1TokenBridgeProxyAddress,
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
        options?.logger
      )
        .addStep({
          factory: L1LidoTokensBridge__factory,
          args: [
            optAddresses.L1CrossDomainMessenger,
            expectedL2TokenBridgeProxyAddress,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            expectedL2TokenProxyAddress,
            expectedL2TokenRebasableProxyAddress,
            l1Params.accountingOracle,
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
            L1LidoTokensBridge__factory.createInterface().encodeFunctionData(
              "initialize",
              [l1Params.admins.bridge]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1TokenBridgeProxyAddress),
        })
        .addStep({
          factory: TokenRateNotifier__factory,
          args: [
            l1Params.deployer.address,
            l1Params.l1AuthorizedRebaseCaller,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1TokenRateNotifierImplAddress),
        })
        .addStep({
          factory: OpStackTokenRatePusher__factory,
          args: [
            optAddresses.L1CrossDomainMessenger,
            l1Params.l1TokenNonRebasable,
            l1Params.accountingOracle,
            expectedL2TokenRateOracleProxyAddress,
            l1Params.l2GasLimitForPushingTokenRate,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1OpStackTokenRatePusherImplAddress),
        });

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
        expectedL2TokenImplAddress,
        expectedL2TokenProxyAddress,
        expectedL2TokenRebasableImplAddress,
        expectedL2TokenRebasableProxyAddress,
        expectedL2TokenBridgeImplAddress,
        expectedL2TokenBridgeProxyAddress,
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress,
        options?.logger
      )
        .addStep({
          factory: TokenRateOracle__factory,
          args: [
            optAddresses.L2CrossDomainMessenger,
            expectedL2TokenBridgeProxyAddress,
            expectedL1OpStackTokenRatePusherImplAddress,
            l2Params.tokenRateOracle.tokenRateOutdatedDelay,
            l2Params.tokenRateOracle.maxAllowedL2ToL1ClockLag,
            l2Params.tokenRateOracle.maxAllowedTokenRateDeviationPerDayBp,
            l2Params.tokenRateOracle.oldestRateAllowedInPauseTimeSpan,
            l2Params.tokenRateOracle.maxAllowedTimeBetweenTokenRateUpdates,
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
            TokenRateOracle__factory.createInterface().encodeFunctionData(
              "initialize",
              [
                l2Params.admins.bridge,
                l2Params.tokenRateOracle.tokenRate,
                l2Params.tokenRateOracle.l1Timestamp
              ]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenRateOracleProxyAddress),
        })
        .addStep({
          factory: ERC20BridgedPermit__factory,
          args: [
            l2TokenNonRebasableName,
            l2TokenNonRebasableSymbol,
            l2Params.l2TokenNonRebasable.version,
            l2TokenNonRebasableDecimals,
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
            assert.equal(c.address, expectedL2TokenProxyAddress),
        })
        .addStep({
          factory: ERC20RebasableBridgedPermit__factory,
          args: [
            l2TokenRebasableName,
            l2TokenRebasableSymbol,
            l2Params.l2TokenRebasable.version,
            l2TokenRebasableDecimals,
            expectedL2TokenProxyAddress,
            expectedL2TokenRateOracleProxyAddress,
            expectedL2TokenBridgeProxyAddress,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenRebasableImplAddress),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            expectedL2TokenRebasableImplAddress,
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
            assert.equal(c.address, expectedL2TokenRebasableProxyAddress),
        })
        .addStep({
          factory: L2ERC20ExtendedTokensBridge__factory,
          args: [
            optAddresses.L2CrossDomainMessenger,
            expectedL1TokenBridgeProxyAddress,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            expectedL2TokenProxyAddress,
            expectedL2TokenRebasableProxyAddress,
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
