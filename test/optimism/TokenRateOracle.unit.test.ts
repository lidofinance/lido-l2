import hre from "hardhat";
import { assert } from "chai";
import { BigNumber } from "ethers";
import { wei } from "../../utils/wei";
import testing, { unit } from "../../utils/testing";
import { tokenRateOracleUnderProxy } from "../../utils/testing/contractsFactory";
import { TokenRateOracle__factory, CrossDomainMessengerStub__factory } from "../../typechain";

unit("TokenRateOracle", ctxFactory)
  .test("state after init", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { bridge, l1TokenBridgeEOA } = ctx.accounts;
    const {
      tokenRate,
      blockTimestamp,
      tokenRateOutdatedDelay,
      maxAllowedL2ToL1ClockLag,
      maxAllowedTokenRateDeviationPerDay
    } = ctx.constants;

    assert.equal(await tokenRateOracle.MESSENGER(), l2MessengerStub.address);
    assert.equal(await tokenRateOracle.L2_ERC20_TOKEN_BRIDGE(), bridge.address);
    assert.equal(await tokenRateOracle.L1_TOKEN_RATE_PUSHER(), l1TokenBridgeEOA.address);
    assert.equalBN(await tokenRateOracle.TOKEN_RATE_OUTDATED_DELAY(), tokenRateOutdatedDelay);
    assert.equalBN(await tokenRateOracle.MAX_ALLOWED_L2_TO_L1_CLOCK_LAG(), maxAllowedL2ToL1ClockLag);
    assert.equalBN(await tokenRateOracle.MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY(), maxAllowedTokenRateDeviationPerDay);

    assert.equalBN(await tokenRateOracle.latestAnswer(), tokenRate);

    const {
      roundId_,
      answer_,
      startedAt_,
      updatedAt_,
      answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestamp);
    assert.equalBN(answer_, tokenRate);
    assert.equalBN(startedAt_, blockTimestamp);
    assert.equalBN(updatedAt_, blockTimestamp);
    assert.equalBN(answeredInRound_, blockTimestamp);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("initialize() :: petrified version", async (ctx) => {
    const { deployer, bridge, l1TokenBridgeEOA } = ctx.accounts;
    const { l2MessengerStub } = ctx.contracts;

    const tokenRateOracleImpl = await new TokenRateOracle__factory(deployer).deploy(
      l2MessengerStub.address,
      bridge.address,
      l1TokenBridgeEOA.address,
      86400,
      86400,
      500
    );

    const petrifiedVersionMark = hre.ethers.constants.MaxUint256;
    assert.equalBN(await tokenRateOracleImpl.getContractVersion(), petrifiedVersionMark);

    await assert.revertsWith(
      tokenRateOracleImpl.initialize(1, 2),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("initialize() :: don't allow to initialize twice", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;

    assert.equalBN(await tokenRateOracle.getContractVersion(), 1);

    await assert.revertsWith(
      tokenRateOracle.initialize(2, 3),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("updateRate() :: called by non-bridge account", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { stranger } = ctx.accounts;
    await assert.revertsWith(
      tokenRateOracle.connect(stranger).updateRate(10, 40),
      "ErrorNotBridgeOrTokenRatePusher()"
    );
  })

  .test("updateRate() :: called by messenger with incorrect cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { stranger, l2MessengerStubEOA } = ctx.accounts;
    await l2MessengerStub.setXDomainMessageSender(stranger.address);
    await assert.revertsWith(
      tokenRateOracle.connect(l2MessengerStubEOA).updateRate(10, 40),
      "ErrorNotBridgeOrTokenRatePusher()"
    );
  })

  .test("updateRate() :: L1 time exceeded allowed L2 clock lag", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRate, blockTimestamp } = ctx.constants;

    const exceededTime = blockTimestamp.add(86400).add(40); // more than one day
    await assert.revertsWith(
      tokenRateOracle.connect(bridge).updateRate(tokenRate, exceededTime),
      "ErrorL1TimestampExceededAllowedClockLag(" + tokenRate + ", " + exceededTime + ")"
    )
  })

  .test("updateRate() :: received token rate is in the past or same time", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRate, blockTimestamp } = ctx.constants;

    const tx0 = await tokenRateOracle
      .connect(bridge)
      .updateRate(tokenRate, blockTimestamp);

    await assert.emits(tokenRateOracle, tx0, "DormantTokenRateUpdateIgnored", [
      tokenRate,
      blockTimestamp,
      blockTimestamp,
    ]);
    await assert.notEmits(tokenRateOracle, tx0, "RateUpdated");

    const timeInPast = blockTimestamp.sub(1000);
    const tx1 = await tokenRateOracle
      .connect(bridge)
      .updateRate(tokenRate, timeInPast);

    await assert.emits(tokenRateOracle, tx1, "DormantTokenRateUpdateIgnored", [
      tokenRate,
      timeInPast,
      blockTimestamp,
    ]);
    await assert.notEmits(tokenRateOracle, tx1, "RateUpdated");
  })

  .test("updateRate() :: token rate is out of range", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRate, blockTimestamp } = ctx.constants;

    const tokenRateTooBig = tokenRate.mul(BigNumber.from('106')).div(BigNumber.from('100'));  // 106%
    const tokenRateTooSmall = tokenRate.mul(BigNumber.from('94')).div(BigNumber.from('100')); // 94%

    var blockTimestampForNextUpdate = blockTimestamp.add(1000);
    await assert.revertsWith(
      tokenRateOracle.connect(bridge).updateRate(tokenRateTooBig, blockTimestampForNextUpdate),
      "ErrorTokenRateIsOutOfRange(" + tokenRateTooBig + ", " + blockTimestampForNextUpdate + ")"
    )

    blockTimestampForNextUpdate = blockTimestampForNextUpdate.add(1000);
    await assert.revertsWith(
      tokenRateOracle.connect(bridge).updateRate(tokenRateTooSmall, blockTimestampForNextUpdate),
      "ErrorTokenRateIsOutOfRange(" + tokenRateTooSmall + ", " + blockTimestampForNextUpdate + ")"
    )
  })

  .test("updateRate() :: happy path called by bridge", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRate, blockTimestamp } = ctx.constants;

    const newTokenRate = tokenRate.mul(BigNumber.from('104')).div(BigNumber.from('100')); // 104%

    const blockTimestampInFuture = blockTimestamp.add(1000);
    const tx = await tokenRateOracle.connect(bridge).updateRate(newTokenRate, blockTimestampInFuture);

    await assert.emits(tokenRateOracle, tx, "TokenRateL1TimestampIsInFuture", [
      newTokenRate,
      blockTimestampInFuture
    ]);

    await assert.emits(tokenRateOracle, tx, "RateUpdated", [
      newTokenRate,
      blockTimestampInFuture
    ]);

    assert.equalBN(await tokenRateOracle.latestAnswer(), newTokenRate);

    const {
      roundId_,
      answer_,
      startedAt_,
      updatedAt_,
      answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestampInFuture);
    assert.equalBN(answer_, newTokenRate);
    assert.equalBN(startedAt_, blockTimestampInFuture);
    assert.equalBN(updatedAt_, blockTimestampInFuture);
    assert.equalBN(answeredInRound_, blockTimestampInFuture);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("updateRate() :: happy path called by messenger with correct cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { l2MessengerStubEOA, l1TokenBridgeEOA } = ctx.accounts;
    const { tokenRate, blockTimestamp } = ctx.constants;

    await l2MessengerStub.setXDomainMessageSender(l1TokenBridgeEOA.address);

    const newTokenRate = tokenRate.mul(BigNumber.from('104')).div(BigNumber.from('100')); // 104%

    const blockTimestampInFuture = blockTimestamp.add(1000);
    const tx = await tokenRateOracle.connect(l2MessengerStubEOA).updateRate(newTokenRate, blockTimestampInFuture);

    await assert.emits(tokenRateOracle, tx, "TokenRateL1TimestampIsInFuture", [
      newTokenRate,
      blockTimestampInFuture
    ]);

    await assert.emits(tokenRateOracle, tx, "RateUpdated", [
      newTokenRate,
      blockTimestampInFuture
    ]);

    assert.equalBN(await tokenRateOracle.latestAnswer(), newTokenRate);

    const {
      roundId_,
      answer_,
      startedAt_,
      updatedAt_,
      answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestampInFuture);
    assert.equalBN(answer_, newTokenRate);
    assert.equalBN(startedAt_, blockTimestampInFuture);
    assert.equalBN(updatedAt_, blockTimestampInFuture);
    assert.equalBN(answeredInRound_, blockTimestampInFuture);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .run();

async function ctxFactory() {
  const tokenRate = BigNumber.from('1164454276599657236');         // value taken from real contact on 23.04.24
  const tokenRateOutdatedDelay = BigNumber.from(86400);            // 1 day
  const maxAllowedL2ToL1ClockLag = BigNumber.from(86400);          // 1 day
  const maxAllowedTokenRateDeviationPerDay = BigNumber.from(500);  // 5%
  const blockTimestamp = await getBlockTimestamp(0);

  const [deployer, bridge, stranger, l1TokenBridgeEOA] = await hre.ethers.getSigners();

  const l2MessengerStub = await new CrossDomainMessengerStub__factory(
    deployer
  ).deploy({ value: wei.toBigNumber(wei`1 ether`) });
  const l2MessengerStubEOA = await testing.impersonate(l2MessengerStub.address);

  const tokenRateOracle = await tokenRateOracleUnderProxy(
    deployer,
    l2MessengerStub.address,
    bridge.address,
    l1TokenBridgeEOA.address,
    tokenRateOutdatedDelay,
    maxAllowedL2ToL1ClockLag,
    maxAllowedTokenRateDeviationPerDay,
    tokenRate,
    blockTimestamp
  );

  return {
    accounts: { deployer, bridge, stranger, l1TokenBridgeEOA, l2MessengerStubEOA },
    contracts: { tokenRateOracle, l2MessengerStub },
    constants: {
      tokenRate, blockTimestamp, tokenRateOutdatedDelay,
      maxAllowedL2ToL1ClockLag, maxAllowedTokenRateDeviationPerDay
    }
  };
}

async function getBlockTimestamp(shift: number) {
  const provider = await hre.ethers.provider;
  const blockNumber = await provider.getBlockNumber();
  return BigNumber.from((await provider.getBlock(blockNumber)).timestamp + shift);
}
