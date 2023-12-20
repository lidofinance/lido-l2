import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";

import { ERC20Stub__factory, ERC20Rebasable__factory, TokenRateOracleStub__factory, OssifiableProxy__factory } from "../../typechain";
import { BigNumber } from "ethers";


unit("ERC20Rebasable", ctxFactory)

  .test("wrappedToken", async (ctx) => {
      const { rebasableProxied, wrappedTokenStub } = ctx.contracts;
      assert.equal(await rebasableProxied.wrappedToken(), wrappedTokenStub.address)
  })

  .test("tokensRateOracle", async (ctx) => {
    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;
    assert.equal(await rebasableProxied.tokensRateOracle(), tokensRateOracleStub.address)
  })

  .test("name()", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.name(), ctx.constants.name)
  )

  .test("symbol()", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.symbol(), ctx.constants.symbol)
  )

  .test("decimals", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.decimals(), ctx.constants.decimals)
  )

  .test("wrap(0)", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    await assert.revertsWith(rebasableProxied.wrap(0), "ErrorZeroSharesWrap()");
  })

  .test("unwrap(0)", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    await assert.revertsWith(rebasableProxied.unwrap(0), "ErrorZeroTokensUnwrap()");
  })

  .test("wrap() positive scenario", async (ctx) => {
    const { rebasableProxied, tokensRateOracleStub, wrappedTokenStub } = ctx.contracts;
    const {user1, user2 } = ctx.accounts;

    await tokensRateOracleStub.setDecimals(5);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    // user1
    assert.equalBN(await rebasableProxied.callStatic.wrap(100), 83);
    const tx = await rebasableProxied.wrap(100);

    assert.equalBN(await rebasableProxied.getTotalShares(), 100);
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 100);

    assert.equal(await wrappedTokenStub.transferFromAddress(), user1.address);
    assert.equal(await wrappedTokenStub.transferFromTo(), rebasableProxied.address);
    assert.equalBN(await wrappedTokenStub.transferFromAmount(), 100);

    // user2
    assert.equalBN(await rebasableProxied.connect(user2).callStatic.wrap(50), 41);
    const tx2 = await rebasableProxied.connect(user2).wrap(50);

    assert.equalBN(await rebasableProxied.getTotalShares(), 150);
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 50);

    assert.equal(await wrappedTokenStub.transferFromAddress(), user2.address);
    assert.equal(await wrappedTokenStub.transferFromTo(), rebasableProxied.address);
    assert.equalBN(await wrappedTokenStub.transferFromAmount(), 50);

    // common state changes
    assert.equalBN(await rebasableProxied.totalSupply(), 125);
  })

  .test("wrap() with wrong oracle decimals", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    await tokensRateOracleStub.setDecimals(0);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    await assert.revertsWith(rebasableProxied.wrap(23), "ErrorInvalidRateDecimals(0)");

    await tokensRateOracleStub.setDecimals(19);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    await assert.revertsWith(rebasableProxied.wrap(23), "ErrorInvalidRateDecimals(19)");
  })

  .test("wrap() with wrong oracle update time", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    await tokensRateOracleStub.setDecimals(10);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(0);

    await assert.revertsWith(rebasableProxied.wrap(5), "ErrorWrongOracleUpdateTime()");
  })

  .test("wrap() with wrong oracle answer", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    await tokensRateOracleStub.setDecimals(10);
    await tokensRateOracleStub.setLatestRoundDataAnswer(0);
    await tokensRateOracleStub.setUpdatedAt(10);

    await assert.revertsWith(rebasableProxied.wrap(21), "ErrorOracleAnswerIsNegative()");
  })


  .test("unwrap() positive scenario", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub, wrappedTokenStub } = ctx.contracts;
    const {user1, user2 } = ctx.accounts;

    await tokensRateOracleStub.setDecimals(7);
    await tokensRateOracleStub.setLatestRoundDataAnswer(14000000);
    await tokensRateOracleStub.setUpdatedAt(14000);

    // user1
    const tx0 = await rebasableProxied.wrap(4500);

    assert.equalBN(await rebasableProxied.callStatic.unwrap(59), 82);
    const tx = await rebasableProxied.unwrap(59);

    assert.equalBN(await rebasableProxied.getTotalShares(), 4418);
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 4418);

    assert.equal(await wrappedTokenStub.transferTo(), user1.address);
    assert.equalBN(await wrappedTokenStub.transferAmount(), 82);

    // // user2
    await rebasableProxied.connect(user2).wrap(200);

    assert.equalBN(await rebasableProxied.connect(user2).callStatic.unwrap(50), 70);
    const tx2 = await rebasableProxied.connect(user2).unwrap(50);

    assert.equalBN(await rebasableProxied.getTotalShares(), 4548);
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 130);

    assert.equal(await wrappedTokenStub.transferTo(), user2.address);
    assert.equalBN(await wrappedTokenStub.transferAmount(), 70);

    // common state changes
    assert.equalBN(await rebasableProxied.totalSupply(), 3248);
  })

  .test("unwrap() with wrong oracle decimals", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    
    await tokensRateOracleStub.setDecimals(10);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    await rebasableProxied.wrap(100);
    await tokensRateOracleStub.setDecimals(0);

    await assert.revertsWith(rebasableProxied.unwrap(23), "ErrorInvalidRateDecimals(0)");

    await tokensRateOracleStub.setDecimals(19);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    await assert.revertsWith(rebasableProxied.unwrap(23), "ErrorInvalidRateDecimals(19)");
  })

  .test("unwrap() with wrong oracle update time", async (ctx) => {

    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    await tokensRateOracleStub.setDecimals(10);
    await tokensRateOracleStub.setLatestRoundDataAnswer(120000);
    await tokensRateOracleStub.setUpdatedAt(300);

    await rebasableProxied.wrap(100);
    await tokensRateOracleStub.setUpdatedAt(0);

    await assert.revertsWith(rebasableProxied.unwrap(5), "ErrorWrongOracleUpdateTime()");
  })

  .test("unwrap() when no balance", async (ctx) => {
    const { rebasableProxied, tokensRateOracleStub } = ctx.contracts;

    await tokensRateOracleStub.setDecimals(8);
    await tokensRateOracleStub.setLatestRoundDataAnswer(12000000);
    await tokensRateOracleStub.setUpdatedAt(1000);

    await assert.revertsWith(rebasableProxied.unwrap(10), "ErrorNotEnoughBalance()");
  })

  .test("approve()", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, user2 } = ctx.accounts;

    // validate initially allowance is zero
    assert.equalBN(
      await rebasableProxied.allowance(user1.address, user2.address),
      "0"
    );

    const amount = 3;

    // validate return value of the method
    assert.isTrue(
      await rebasableProxied.callStatic.approve(user2.address, amount)
    );

    // approve tokens
    const tx = await rebasableProxied.approve(user2.address, amount);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      user1.address,
      user2.address,
      amount,
    ]);

    // validate allowance was set
    assert.equalBN(
      await rebasableProxied.allowance(user1.address, user2.address),
      amount
    );
  })

  .run();

async function ctxFactory() {
    const name = "StETH Test Token";
    const symbol = "StETH";
    const decimals = 18;
    const [deployer, user1, user2] = await hre.ethers.getSigners();

    const wrappedTokenStub = await new ERC20Stub__factory(deployer).deploy(); 

    const tokensRateOracleStub = await new TokenRateOracleStub__factory(deployer).deploy(); 

    const rebasableTokenImpl = await new ERC20Rebasable__factory(deployer).deploy(
      wrappedTokenStub.address,
      tokensRateOracleStub.address,
      name,
      symbol,
      decimals
    );
    rebasableTokenImpl.wrap
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [hre.ethers.constants.AddressZero],
    });
    
    const l2TokensProxy = await new OssifiableProxy__factory(deployer).deploy(
      rebasableTokenImpl.address,
      deployer.address,
      ERC20Rebasable__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
      ])
    );
  
    const rebasableProxied = ERC20Rebasable__factory.connect(
      l2TokensProxy.address,
      user1
    );
    
    return {
      accounts: { deployer, user1, user2 },
      constants: { name, symbol, decimals },
      contracts: { rebasableProxied, wrappedTokenStub, tokensRateOracleStub }
    };
}
