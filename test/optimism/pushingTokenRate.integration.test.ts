import { assert } from "chai";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import network from "../../utils/network";
import testing, { scenario } from "../../utils/testing";
import deploymentOracle from "../../utils/optimism/deploymentOracle";
import { getBridgeExecutorParams } from "../../utils/bridge-executor";
import { tokenRateAndTimestampPacked } from "../../utils/testing/helpers";
import { BigNumber } from "ethers";
import { getBlockTimestamp } from "../../utils/testing/helpers";
import {
  ERC20BridgedStub__factory,
  ERC20WrapperStub__factory,
  OptimismBridgeExecutor__factory,
  TokenRateNotifier__factory,
  TokenRateOracle__factory,
  AccountingOracleStub__factory
} from "../../typechain";

scenario("Optimism :: Token Rate Oracle integration test", ctxFactory)

  .step("Push Token Rate", async (ctx) => {
    const {
      tokenRateNotifier,
      tokenRateOracle,
      opTokenRatePusher,
      l1CrossDomainMessenger,
      genesisTime,
      secondsPerSlot,
      lastProcessingRefSlot,
      tokenRate
    } = ctx;

    const account = ctx.accounts.accountA;

    const tx = await tokenRateNotifier
      .connect(account.l1Signer)
      .handlePostTokenRebase(1, 2, 3, 4, 5, 6, 7);

    const messageNonce = await l1CrossDomainMessenger.messageNonce();

    const updateRateTime = genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));

    const l2Calldata = tokenRateOracle.interface.encodeFunctionData(
      "updateRate",
      [
        tokenRate,
        updateRateTime
      ]
    );

    await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
      tokenRateOracle.address,
      opTokenRatePusher,
      l2Calldata,
      messageNonce,
      1000,
    ]);
  })

  .step("Finalize pushing rate", async (ctx) => {
    const {
      opTokenRatePusher,
      tokenRateOracle,
      l1CrossDomainMessenger,
      genesisTime, secondsPerSlot, lastProcessingRefSlot, tokenRate
    } = ctx;

    const account = ctx.accounts.accountA;
    await l1CrossDomainMessenger
      .connect(account.l1Signer)
      .setXDomainMessageSender(opTokenRatePusher);

    const updateRateTime = genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));

    await ctx.l2CrossDomainMessenger
      .connect(ctx.accounts.l1CrossDomainMessengerAliased)
      .relayMessage(
        1,
        opTokenRatePusher,
        tokenRateOracle.address,
        0,
        300_000,
        tokenRateOracle.interface.encodeFunctionData("updateRate", [
          tokenRate,
          updateRateTime
        ]),
        { gasLimit: 5_000_000 }
      );

    const answer = await tokenRateOracle.latestAnswer();
    assert.equalBN(answer, tokenRate);

    const [
      ,
      tokenRateAnswer,
      startedAt_,
      ,
    ] = await tokenRateOracle.latestRoundData();

    assert.equalBN(tokenRateAnswer, tokenRate);
    assert.equalBN(startedAt_, updateRateTime);
  })

  .run();

async function ctxFactory() {
  const l2GasLimitForPushingTokenRate = 1000;
  const tokenRateOutdatedDelay = 86400;
  const maxAllowedL2ToL1ClockLag = BigNumber.from(86400);
  const maxAllowedTokenRateDeviationPerDay = BigNumber.from(500);
  const tokenRate = BigNumber.from('1164454276599657236000000000');

  const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");
  const [l1Provider, l2Provider] = network
    .multichain(["eth", "opt"], networkName)
    .getProviders({ forking: true });
  const l1Deployer = testing.accounts.deployer(l1Provider);
  const l2Deployer = testing.accounts.deployer(l2Provider);

  const blockTimestamp = await getBlockTimestamp(l1Provider, 0);
  const blockTimestampInPast = await getBlockTimestamp(l1Provider, -86400);

  const genesisTime = blockTimestamp;
  const secondsPerSlot = BigNumber.from(10);
  const lastProcessingRefSlot = BigNumber.from(20);

  const optContracts = optimism.contracts(networkName, { forking: true });
  const l2CrossDomainMessenger = optContracts.L2CrossDomainMessenger;
  const testingOnDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);
  const optAddresses = optimism.addresses(networkName);

  const govBridgeExecutor = testingOnDeployedContracts
    ? OptimismBridgeExecutor__factory.connect(
      testing.env.OPT_GOV_BRIDGE_EXECUTOR(),
      l2Provider
    )
    : await new OptimismBridgeExecutor__factory(l2Deployer).deploy(
      optAddresses.L2CrossDomainMessenger,
      l1Deployer.address,
      ...getBridgeExecutorParams(),
      l2Deployer.address
    );

  const l1TokenRebasable = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token Rebasable",
    "TTR"
  );
  const l1Token = await new ERC20WrapperStub__factory(l1Deployer).deploy(
    l1TokenRebasable.address,
    "Test Token",
    "TT",
    tokenRate
  );

  const accountingOracle = await new AccountingOracleStub__factory(l1Deployer).deploy(
    genesisTime,
    secondsPerSlot,
    lastProcessingRefSlot
  );

  const [ethDeployScript, optDeployScript] = await deploymentOracle(
    networkName
  ).oracleDeployScript(
    l1Token.address,
    accountingOracle.address,
    l2GasLimitForPushingTokenRate,
    tokenRateOutdatedDelay,
    {
      deployer: l1Deployer,
      admins: {
        proxy: l1Deployer.address,
        bridge: l1Deployer.address
      },
      contractsShift: 0
    },
    {
      deployer: l2Deployer,
      admins: {
        proxy: govBridgeExecutor.address,
        bridge: govBridgeExecutor.address,
      },
      contractsShift: 0,
      tokenRateOracle: {
        maxAllowedL2ToL1ClockLag: maxAllowedL2ToL1ClockLag,
        maxAllowedTokenRateDeviationPerDay: maxAllowedTokenRateDeviationPerDay,
        tokenRate: tokenRate,
        l1Timestamp: BigNumber.from(blockTimestampInPast)
      }
    }
  );

  await ethDeployScript.run();
  await optDeployScript.run();

  await optimism.testing(networkName).stubL1CrossChainMessengerContract();

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(optContracts.L1CrossDomainMessengerStub.address),
    l2Provider
  );
  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  const tokenRateNotifier = TokenRateNotifier__factory.connect(
    ethDeployScript.tokenRateNotifierImplAddress,
    l1Provider
  );
  await tokenRateNotifier
    .connect(l1Deployer)
    .addObserver(ethDeployScript.opStackTokenRatePusherImplAddress);
  const tokenRateOracle = TokenRateOracle__factory.connect(
    optDeployScript.tokenRateOracleProxyAddress,
    l2Provider
  );

  const accountA = testing.accounts.accountA(l1Provider, l2Provider);
  const l1CrossDomainMessenger = optContracts.L1CrossDomainMessengerStub;

  return {
    tokenRateNotifier,
    tokenRateOracle,
    opTokenRatePusher: ethDeployScript.opStackTokenRatePusherImplAddress,
    l1CrossDomainMessenger,
    l2CrossDomainMessenger,
    l1Token,
    accountingOracle,
    l1Provider,
    blockTimestamp,
    tokenRate,
    genesisTime, secondsPerSlot, lastProcessingRefSlot,
    accounts: {
      accountA,
      l1CrossDomainMessengerAliased
    }
  };
}
