import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { TokenRateOracle__factory } from "../../typechain";

unit("TokenRateOracle", ctxFactory)

  .test("state after init", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge, updater } = ctx.accounts;

    assert.equal(await tokenRateOracle.bridge(), bridge.address);
    assert.equal(await tokenRateOracle.tokenRateUpdater(), updater.address);

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

  .test("wrong owner", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge, updater, stranger } = ctx.accounts;
    tokenRateOracle.connect(bridge).updateRate(10, 20);
    tokenRateOracle.connect(updater).updateRate(10, 23);
    await assert.revertsWith(tokenRateOracle.connect(stranger).updateRate(10, 40), "NotAnOwner(\""+stranger.address+"\")");
  })

  .test("incorrect time", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { bridge } = ctx.accounts;
    
    tokenRateOracle.connect(bridge).updateRate(10, 1000);
    await assert.revertsWith(tokenRateOracle.connect(bridge).updateRate(12, 20), "IncorrectRateTimestamp()");
  })

  .test("state after update token rate", async (ctx) => {
    const { tokenRateOracle } = ctx.contracts;
    const { updater } = ctx.accounts;

    const currentTime = Date.now();
    const tokenRate = 123;

    await tokenRateOracle.connect(updater).updateRate(tokenRate, currentTime );

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

    const [deployer, bridge, updater, stranger] = await hre.ethers.getSigners();

    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
        bridge.address,
        updater.address
    ); 
    
    return {
      accounts: { deployer, bridge, updater, stranger },
      contracts: { tokenRateOracle }
    };
}
