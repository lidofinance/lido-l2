import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { TokenRateOracle__factory } from "../../typechain";
import { ethers } from "ethers";

unit("TokenRateOracle", ctxFactory)

  .test("init zero slotsPerEpoch", async (ctx) => {
    const [deployer] = await hre.ethers.getSigners();
    await assert.revertsWith(new TokenRateOracle__factory(deployer).deploy(
        0,
        10,
        1000,
        100,
        50
    ), "InvalidChainConfig()");
  })

  .test("init zero secondsPerSlot", async (ctx) => {
    const [deployer] = await hre.ethers.getSigners();
    await assert.revertsWith(new TokenRateOracle__factory(deployer).deploy(
        41,
        0,
        1000,
        100,
        50
    ), "InvalidChainConfig()");
  })

  .test("state after init", async (ctx) => {
    const { tokensRateOracle } = ctx.contracts;

    assert.equalBN(await tokensRateOracle.latestAnswer(), 0);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokensRateOracle.latestRoundData();

    assert.equalBN(roundId_, 170307199);
    assert.equalBN(answer_, 0);
    assert.equalBN(startedAt_, 1703072990);
    assert.equalBN(updatedAt_, 0);
    assert.equalBN(answeredInRound_, 0);

    assert.equalBN(await tokensRateOracle.decimals(), 0);
  })

  .test("state after update token rate", async (ctx) => {
    const { tokensRateOracle } = ctx.contracts;

    await tokensRateOracle.updateRate(2, ethers.constants.MaxInt256 );

    assert.equalBN(await tokensRateOracle.latestAnswer(), 2);

    const {
        roundId_,
        answer_,
        startedAt_,
        updatedAt_,
        answeredInRound_
    } = await tokensRateOracle.latestRoundData();

    assert.equalBN(roundId_, 170307199);
    assert.equalBN(answer_, 2);
    assert.equalBN(startedAt_, 1703072990);
    assert.equalBN(updatedAt_, ethers.constants.MaxInt256);
    assert.equalBN(answeredInRound_, 666);

    assert.equalBN(await tokensRateOracle.decimals(), 10);
  })

  .run();

async function ctxFactory() {

    const [deployer] = await hre.ethers.getSigners();

    const tokensRateOracle = await new TokenRateOracle__factory(deployer).deploy(
        32,
        10,
        1000,
        100,
        50
    ); 
    
    return {
      accounts: { deployer },
      contracts: { tokensRateOracle }
    };
}
