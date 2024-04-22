import hre from "hardhat";
import { assert } from "chai";
import { BigNumber } from "ethers";
import testing, { unit } from "../../utils/testing";
import {
    TokenRateOracle__factory,
    CrossDomainMessengerStub__factory,
    OssifiableProxy__factory
} from "../../typechain";
import { wei } from "../../utils/wei";

unit("TokenRateOracle", ctxFactory)

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
      tokenRateOracleImpl.initialize(1,2),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("initialize() :: re-initialization", async (ctx) => {

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

    const tokenRateOracleProxy = await new OssifiableProxy__factory(
        deployer
    ).deploy(
        tokenRateOracleImpl.address,
        deployer.address,
        tokenRateOracleImpl.interface.encodeFunctionData("initialize", [1,2])
    );

    const tokenRateOracle = TokenRateOracle__factory.connect(
        tokenRateOracleProxy.address,
        deployer
    );

    assert.equalBN(await tokenRateOracle.getContractVersion(), 1);

    await assert.revertsWith(
      tokenRateOracle.initialize(2,3),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("state after init", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { bridge, l1TokenBridgeEOA } = ctx.accounts;
    const { tokenRateCorrect, blockTimestamp } = ctx.constants;

    assert.equal(await tokenRateOracle.MESSENGER(), l2MessengerStub.address);
    assert.equal(await tokenRateOracle.L2_ERC20_TOKEN_BRIDGE(), bridge.address);
    assert.equal(await tokenRateOracle.L1_TOKEN_RATE_PUSHER(), l1TokenBridgeEOA.address);
    assert.equalBN(await tokenRateOracle.TOKEN_RATE_OUTDATED_DELAY(), 86400);

    assert.equalBN(await tokenRateOracle.latestAnswer(), tokenRateCorrect);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestamp);
    assert.equalBN(answer_, tokenRateCorrect);
    assert.equalBN(startedAt_, blockTimestamp);
    assert.equalBN(updatedAt_, blockTimestamp);
    assert.equalBN(answeredInRound_, blockTimestamp);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("updateRate() :: called by non-bridge account", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { stranger } = ctx.accounts;
    await assert.revertsWith(tokenRateOracle.connect(stranger).updateRate(10, 40), "ErrorNotBridgeOrTokenRatePusher()");
  })

  .test("updateRate() :: called by messenger with incorrect cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { stranger, l2MessengerStubEOA } = ctx.accounts;
    await l2MessengerStub.setXDomainMessageSender(stranger.address);
    await assert.revertsWith(tokenRateOracle.connect(l2MessengerStubEOA).updateRate(10, 40), "ErrorNotBridgeOrTokenRatePusher()");
  })

  .test("updateRate() :: L1 time exceeded allowed L2 clock lag", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRateCorrect, blockTimestamp } = ctx.constants;

    const exceededTime = blockTimestamp+86400+40;
    await assert.revertsWith(
        tokenRateOracle.connect(bridge).updateRate(tokenRateCorrect, exceededTime),
        "ErrorL1TimestampExceededAllowedClockLag("+tokenRateCorrect+", "+exceededTime+")"
    )
  })

  .test("updateRate() :: received token rate is in the past or same time", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRateCorrect, blockTimestamp } = ctx.constants;

    const tx0 = await tokenRateOracle.connect(bridge).updateRate(tokenRateCorrect, blockTimestamp);

    await assert.emits(tokenRateOracle, tx0, "DormantTokenRateUpdateIgnored", [
      tokenRateCorrect,
      blockTimestamp,
      blockTimestamp,
    ]);

    const timeInPast = blockTimestamp-1000;
    const tx1 = await tokenRateOracle.connect(bridge).updateRate(tokenRateCorrect, timeInPast);

    await assert.emits(tokenRateOracle, tx1, "DormantTokenRateUpdateIgnored", [
      tokenRateCorrect,
      blockTimestamp,
      timeInPast,
    ]);
  })

  .test("updateRate() :: ErrorTokenRateIsOutOfRange", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { tokenRateCorrect, blockTimestamp } = ctx.constants;

    const tokenRateTooBig = tokenRateCorrect.mul(BigNumber.from('2'));
    const tokenRateTooSmall = tokenRateCorrect.div(BigNumber.from('2'));

    var blockTimestampForNextUpdate = blockTimestamp + 1000;
    await assert.revertsWith(
        tokenRateOracle.connect(bridge).updateRate(tokenRateTooBig, blockTimestampForNextUpdate),
        "ErrorTokenRateIsOutOfRange("+tokenRateTooBig+", "+blockTimestampForNextUpdate+")"
    )

    blockTimestampForNextUpdate += 1000;
    await assert.revertsWith(
        tokenRateOracle.connect(bridge).updateRate(tokenRateTooSmall, blockTimestampForNextUpdate),
        "ErrorTokenRateIsOutOfRange("+tokenRateTooSmall+", "+blockTimestampForNextUpdate+")"
    )
  })

  .test("updateRate() :: happy path called by bridge", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    const { blockTimestamp } = ctx.constants;

    const decimalsBN = BigNumber.from(10).pow(18-2);
    const newTokenRateCorrect = BigNumber.from('125').mul(decimalsBN);
    const blockTimestampInFuture = blockTimestamp + 1000;
    const tx = await tokenRateOracle.connect(bridge).updateRate(newTokenRateCorrect, blockTimestampInFuture);

    await assert.emits(tokenRateOracle, tx, "TokenRateL1TimestampAheadOfL2Time", [
      newTokenRateCorrect,
      blockTimestampInFuture
    ]);

    await assert.emits(tokenRateOracle, tx, "RateUpdated", [
      newTokenRateCorrect,
      blockTimestampInFuture
    ]);

    assert.equalBN(await tokenRateOracle.latestAnswer(), newTokenRateCorrect);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestampInFuture);
    assert.equalBN(answer_, newTokenRateCorrect);
    assert.equalBN(startedAt_, blockTimestampInFuture);
    assert.equalBN(updatedAt_, blockTimestampInFuture);
    assert.equalBN(answeredInRound_, blockTimestampInFuture);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("updateRate() :: happy path called by messenger with correct cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { l2MessengerStubEOA, l1TokenBridgeEOA } = ctx.accounts;
    const { blockTimestamp } = ctx.constants;

    await l2MessengerStub.setXDomainMessageSender(l1TokenBridgeEOA.address);

    const decimalsBN = BigNumber.from(10).pow(18-2);
    const newTokenRateCorrect = BigNumber.from('125').mul(decimalsBN);
    const blockTimestampInFuture = blockTimestamp + 1000;
    const tx = await tokenRateOracle.connect(l2MessengerStubEOA).updateRate(newTokenRateCorrect, blockTimestampInFuture);

    await assert.emits(tokenRateOracle, tx, "TokenRateL1TimestampAheadOfL2Time", [
      newTokenRateCorrect,
      blockTimestampInFuture
    ]);

    await assert.emits(tokenRateOracle, tx, "RateUpdated", [
      newTokenRateCorrect,
      blockTimestampInFuture
    ]);

    assert.equalBN(await tokenRateOracle.latestAnswer(), newTokenRateCorrect);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, blockTimestampInFuture);
    assert.equalBN(answer_, newTokenRateCorrect);
    assert.equalBN(startedAt_, blockTimestampInFuture);
    assert.equalBN(updatedAt_, blockTimestampInFuture);
    assert.equalBN(answeredInRound_, blockTimestampInFuture);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .run();

async function ctxFactory() {
    const decimals = 18;
    const decimalsBN = BigNumber.from(10).pow(decimals-1);
    const tokenRateCorrect = BigNumber.from('12').mul(decimalsBN);
    const tokenRateTooBig = BigNumber.from('2000').pow(decimals);
    const tokenRateTooSmall = BigNumber.from('1').pow(decimals-3);

    const provider = await hre.ethers.provider;
    const blockNumber = await provider.getBlockNumber();
    const blockTimestamp = (await provider.getBlock(blockNumber)).timestamp;

    const [deployer, bridge, stranger, l1TokenBridgeEOA] = await hre.ethers.getSigners();

    const l2MessengerStub = await new CrossDomainMessengerStub__factory(
        deployer
    ).deploy({ value: wei.toBigNumber(wei`1 ether`) });
    const l2MessengerStubEOA = await testing.impersonate(l2MessengerStub.address);

    const tokenRateOracleImpl = await new TokenRateOracle__factory(deployer).deploy(
        l2MessengerStub.address,
        bridge.address,
        l1TokenBridgeEOA.address,
        86400,
        86400,
        500
    );

    const tokenRateOracleProxy = await new OssifiableProxy__factory(
        deployer
    ).deploy(
        tokenRateOracleImpl.address,
        deployer.address,
        tokenRateOracleImpl.interface.encodeFunctionData("initialize", [
            tokenRateCorrect,
            blockTimestamp
        ])
    );

    const tokenRateOracle = TokenRateOracle__factory.connect(
        tokenRateOracleProxy.address,
        deployer
    );

    return {
      accounts: { deployer, bridge, stranger, l1TokenBridgeEOA, l2MessengerStubEOA },
      contracts: { tokenRateOracle, l2MessengerStub },
      constants: { tokenRateCorrect, tokenRateTooBig, tokenRateTooSmall, blockTimestamp }
    };
}
