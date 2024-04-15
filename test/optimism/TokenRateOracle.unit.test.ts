import hre from "hardhat";
import { assert } from "chai";
import testing, { unit } from "../../utils/testing";
import {
    TokenRateOracle__factory,
    CrossDomainMessengerStub__factory
} from "../../typechain";
import { wei } from "../../utils/wei";

unit("TokenRateOracle", ctxFactory)

  .test("state after init", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { bridge, l1TokenBridgeEOA } = ctx.accounts;

    assert.equal(await tokenRateOracle.MESSENGER(), l2MessengerStub.address);
    assert.equal(await tokenRateOracle.L2_ERC20_TOKEN_BRIDGE(), bridge.address);
    assert.equal(await tokenRateOracle.L1_TOKEN_RATE_PUSHER(), l1TokenBridgeEOA.address);
    assert.equalBN(await tokenRateOracle.TOKEN_RATE_OUTDATED_DELAY(), 86400);

    assert.equalBN(await tokenRateOracle.latestAnswer(), 0);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, 0);
    assert.equalBN(answer_, 0);
    assert.equalBN(startedAt_, 0);
    assert.equalBN(updatedAt_, 0);
    assert.equalBN(answeredInRound_, 0);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("updateRate() :: called by non-bridge account", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { stranger } = ctx.accounts;
    await assert.revertsWith(tokenRateOracle.connect(stranger).updateRate(10, 40), "ErrorNoRights(\""+stranger.address+"\")");
  })

  .test("updateRate() :: called by messenger with incorrect cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { stranger, l2MessengerStubEOA } = ctx.accounts;
    await l2MessengerStub.setXDomainMessageSender(stranger.address);
    await assert.revertsWith(tokenRateOracle.connect(l2MessengerStubEOA).updateRate(10, 40), "ErrorNoRights(\""+l2MessengerStubEOA._address+"\")");
  })

  .test("updateRate() :: incorrect time", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    await tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.revertsWith(tokenRateOracle.connect(bridge).updateRate(12, 20), "ErrorIncorrectRateTimestamp()");
  })

  .test("updateRate() :: don't update state if values are the same", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    const tx1 = await tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.emits(tokenRateOracle, tx1, "RateUpdated", [10, 1000]);

    const tx2 = await tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.notEmits(tokenRateOracle, tx2, "RateUpdated");
  })

  .test("updateRate() :: happy path called by bridge", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    const currentTime = Date.now();
    const tokenRate = 123;

    await tokenRateOracle.connect(bridge).updateRate(tokenRate, currentTime);

    assert.equalBN(await tokenRateOracle.latestAnswer(), tokenRate);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, currentTime);
    assert.equalBN(answer_, tokenRate);
    assert.equalBN(startedAt_, currentTime);
    assert.equalBN(updatedAt_, currentTime);
    assert.equalBN(answeredInRound_, currentTime);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .test("updateRate() :: happy path called by messenger with correct cross-domain sender", async (ctx) => {
    const { tokenRateOracle, l2MessengerStub } = ctx.contracts;
    const { l2MessengerStubEOA, l1TokenBridgeEOA } = ctx.accounts;

    await l2MessengerStub.setXDomainMessageSender(l1TokenBridgeEOA.address);

    const currentTime = Date.now();
    const tokenRate = 123;

    await tokenRateOracle.connect(l2MessengerStubEOA).updateRate(tokenRate, currentTime);

    assert.equalBN(await tokenRateOracle.latestAnswer(), tokenRate);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokenRateOracle.latestRoundData();

    assert.equalBN(roundId_, currentTime);
    assert.equalBN(answer_, tokenRate);
    assert.equalBN(startedAt_, currentTime);
    assert.equalBN(updatedAt_, currentTime);
    assert.equalBN(answeredInRound_, currentTime);
    assert.equalBN(await tokenRateOracle.decimals(), 18);
  })

  .run();

async function ctxFactory() {

    const [deployer, bridge, stranger, l1TokenBridgeEOA] = await hre.ethers.getSigners();

    const l2MessengerStub = await new CrossDomainMessengerStub__factory(
        deployer
    ).deploy({ value: wei.toBigNumber(wei`1 ether`) });
    const l2MessengerStubEOA = await testing.impersonate(l2MessengerStub.address);

    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
        l2MessengerStub.address,
        bridge.address,
        l1TokenBridgeEOA.address,
        86400
    );

    return {
      accounts: { deployer, bridge, stranger, l1TokenBridgeEOA, l2MessengerStubEOA },
      contracts: { tokenRateOracle, l2MessengerStub }
    };
}
