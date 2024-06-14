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

interface OptL1UpgradeScriptParams extends DeployScriptParams {
  l1TokenNonRebasable: string;
  l1TokenRebasable: string;
  accountingOracle: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  l1TokenBridge: string;
  l1AuthorizedRebaseCaller: string;
}

interface OptL2UpgradeScriptParams extends DeployScriptParams {
  l2TokenBridge: string;
  l2TokenNonRebasable: {
    address: string;
    name?: string;
    symbol?: string;
    version: string;
    decimals?: BigNumber;
  };
  l2TokenRebasable: {
    name?: string;
    symbol?: string;
    version: string;
    decimals?: BigNumber;
  };
  tokenRateOracle: {
    constructor: {
      tokenRateOutdatedDelay: BigNumber;
      maxAllowedL2ToL1ClockLag: BigNumber;
      maxAllowedTokenRateDeviationPerDayBp: BigNumber;
      oldestRateAllowedInPauseTimeSpan: BigNumber;
      maxAllowedTimeBetweenTokenRateUpdates: BigNumber;
    }
    initialize: {
      tokenRate: BigNumber;
      l1Timestamp: BigNumber;
    }
  }
}

export class L1UpgradeScript extends DeployScript {

  constructor(
    deployer: Wallet,
    bridgeProxyAddress: string,
    bridgeImplAddress: string,
    tokenRateNotifierImplAddress: string,
    opStackTokenRatePusherImplAddress: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.bridgeProxyAddress = bridgeProxyAddress;
    this.bridgeImplAddress = bridgeImplAddress;
    this.tokenRateNotifierImplAddress = tokenRateNotifierImplAddress;
    this.opStackTokenRatePusherImplAddress = opStackTokenRatePusherImplAddress;
  }

  public bridgeProxyAddress: string;
  public bridgeImplAddress: string;
  public tokenRateNotifierImplAddress: string;
  public opStackTokenRatePusherImplAddress: string;
}

export class L2UpgradeScript extends DeployScript {

  constructor(
    deployer: Wallet,
    tokenImplAddress: string,
    tokenRebasableImplAddress: string,
    tokenRebasableProxyAddress: string,
    tokenBridgeProxyAddress: string,
    tokenBridgeImplAddress: string,
    tokenRateOracleImplAddress: string,
    tokenRateOracleProxyAddress: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.tokenImplAddress = tokenImplAddress;
    this.tokenRebasableImplAddress = tokenRebasableImplAddress;
    this.tokenRebasableProxyAddress = tokenRebasableProxyAddress;
    this.tokenBridgeProxyAddress = tokenBridgeProxyAddress;
    this.tokenBridgeImplAddress = tokenBridgeImplAddress;
    this.tokenRateOracleImplAddress = tokenRateOracleImplAddress;
    this.tokenRateOracleProxyAddress = tokenRateOracleProxyAddress;
  }

  public tokenImplAddress: string;
  public tokenRebasableImplAddress: string;
  public tokenRebasableProxyAddress: string;
  public tokenBridgeProxyAddress: string;
  public tokenBridgeImplAddress: string;
  public tokenRateOracleImplAddress: string;
  public tokenRateOracleProxyAddress: string;
}


/// L1 part
///     new TokenRateNotifier Impl
///     new OpStackTokenRatePusher Impl
///     new L1Bridge Impl
/// L2 part
///     TokenRateOracle + proxy
///     new L2Bridge Impl
///     RebasableToken(stETH) Impl and Proxy (because it was never deployed before)
///     Non-rebasable token (wstETH) new Impl with Permissions

export default function upgrade(
  networkName: NetworkName,
  options: OptDeploymentOptions = {}
) {
  const optAddresses = addresses(networkName, options);
  return {
    async upgradeScript(
      l1Params: OptL1UpgradeScriptParams,
      l2Params: OptL2UpgradeScriptParams,
    ): Promise<[L1UpgradeScript, L2UpgradeScript]> {

      const [
        expectedL1TokenBridgeImplAddress,
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
      ] = await network.predictAddresses(l1Params.deployer, l1Params.contractsShift + 3);

      const [
        // Oracle + Proxy
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress,
        // wstETH Impl
        expectedL2TokenImplAddress,
        // stETH Impl + Proxy
        expectedL2TokenRebasableImplAddress,
        expectedL2TokenRebasableProxyAddress,
        // L2Bridge Impl
        expectedL2TokenBridgeImplAddress
      ] = await network.predictAddresses(l2Params.deployer, l2Params.contractsShift + 6);

      const l1UpgradeScript = new L1UpgradeScript(
        l1Params.deployer,
        l1Params.l1TokenBridge,
        expectedL1TokenBridgeImplAddress,
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
        options?.logger
      )
        .addStep({
          factory: L1LidoTokensBridge__factory,
          args: [
            optAddresses.L1CrossDomainMessenger,
            l2Params.l2TokenBridge,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            l2Params.l2TokenNonRebasable.address,
            expectedL2TokenRebasableProxyAddress,
            l1Params.accountingOracle,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1TokenBridgeImplAddress),
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

      const l2UpgradeScript = new L2UpgradeScript(
        l2Params.deployer,
        expectedL2TokenImplAddress,
        expectedL2TokenRebasableImplAddress,
        expectedL2TokenRebasableProxyAddress,
        l2Params.l2TokenBridge,
        expectedL2TokenBridgeImplAddress,
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress,
        options?.logger
      )
        .addStep({
          factory: TokenRateOracle__factory,
          args: [
            optAddresses.L2CrossDomainMessenger,
            l2Params.l2TokenBridge,
            expectedL1OpStackTokenRatePusherImplAddress,
            l2Params.tokenRateOracle.constructor.tokenRateOutdatedDelay,
            l2Params.tokenRateOracle.constructor.maxAllowedL2ToL1ClockLag,
            l2Params.tokenRateOracle.constructor.maxAllowedTokenRateDeviationPerDayBp,
            l2Params.tokenRateOracle.constructor.oldestRateAllowedInPauseTimeSpan,
            l2Params.tokenRateOracle.constructor.maxAllowedTimeBetweenTokenRateUpdates,
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
                l2Params.tokenRateOracle.initialize.tokenRate,
                l2Params.tokenRateOracle.initialize.l1Timestamp
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
            l2Params.l2TokenBridge,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenImplAddress),
        })
        .addStep({
          factory: ERC20RebasableBridgedPermit__factory,
          args: [
            l2TokenRebasableName,
            l2TokenRebasableSymbol,
            l2Params.l2TokenRebasable.version,
            l2TokenRebasableDecimals,
            l2Params.l2TokenNonRebasable.address,
            expectedL2TokenRateOracleProxyAddress,
            l2Params.l2TokenBridge,
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
            l1Params.l1TokenBridge,
            l1Params.l1TokenNonRebasable,
            l1Params.l1TokenRebasable,
            l2Params.l2TokenNonRebasable.address,
            expectedL2TokenRebasableProxyAddress,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenBridgeImplAddress),
        });

      return [l1UpgradeScript as L1UpgradeScript, l2UpgradeScript as L2UpgradeScript];
    },
  };
}
