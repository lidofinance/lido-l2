import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { TokenRateOracle__factory } from "../../typechain";

unit("TokenRateOracle", ctxFactory)

  .test("state after init", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    assert.equal(await tokenRateOracle.BRIDGE(), bridge.address);

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

  .test("updateRate() :: no rights to call", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge, stranger } = ctx.accounts;
    tokenRateOracle.connect(bridge).updateRate(10, 20);
    await assert.revertsWith(tokenRateOracle.connect(stranger).updateRate(10, 40), "ErrorNoRights(\""+stranger.address+"\")");
  })

  .test("updateRate() :: incorrect time", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.revertsWith(tokenRateOracle.connect(bridge).updateRate(12, 20), "ErrorIncorrectRateTimestamp()");
  })

  .test("updateRate() :: dont update state if values are the same", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    const tx1 = await tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.emits(tokenRateOracle, tx1, "RateUpdated", [10, 1000]);

    const tx2 = await tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.notEmits(tokenRateOracle, tx2, "RateUpdated");
  })

  .test("updateRate() :: happy path", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;

    const currentTime = Date.now();
    const tokenRate = 123;

    await tokenRateOracle.connect(bridge).updateRate(tokenRate, currentTime );

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

    const [deployer, bridge, stranger] = await hre.ethers.getSigners();

    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
        bridge.address,
        86400
    );

    return {
      accounts: { deployer, bridge, stranger },
      contracts: { tokenRateOracle }
    };
}
