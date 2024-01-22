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

  .test("tokenRateOracle", async (ctx) => {
    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    assert.equal(await rebasableProxied.tokenRateOracle(), tokenRateOracleStub.address)
  })

  .test("name()", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.name(), ctx.constants.name)
  )

  .test("symbol()", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.symbol(), ctx.constants.symbol)
  )

  .test("initialize() :: name already set", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const wrappedTokenStub = await new ERC20Stub__factory(deployer).deploy(); 
    const tokenRateOracleStub = await new TokenRateOracleStub__factory(deployer).deploy(); 
    const rebasableTokenImpl = await new ERC20Rebasable__factory(deployer).deploy(
      "name",
      "",
      10,
      wrappedTokenStub.address,
      tokenRateOracleStub.address,
      owner.address
    );
    await assert.revertsWith(
      rebasableTokenImpl.initialize("New Name", ""),
      "ErrorNameAlreadySet()"
    );
  })

  .test("initialize() :: symbol already set", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const wrappedTokenStub = await new ERC20Stub__factory(deployer).deploy(); 
    const tokenRateOracleStub = await new TokenRateOracleStub__factory(deployer).deploy(); 
    const rebasableTokenImpl = await new ERC20Rebasable__factory(deployer).deploy(
      "",
      "symbol",
      10,
      wrappedTokenStub.address,
      tokenRateOracleStub.address,
      owner.address
    );
    await assert.revertsWith(
      rebasableTokenImpl.initialize("", "New Symbol"),
      "ErrorSymbolAlreadySet()"
    );
  })

  .test("decimals", async (ctx) =>
    assert.equal(await ctx.contracts.rebasableProxied.decimals(), ctx.constants.decimalsToSet)
  )

  .test("totalShares", async (ctx) => {
    const { premintShares } = ctx.constants;
    assert.equalBN(await ctx.contracts.rebasableProxied.getTotalShares(), premintShares);
  })

  .test("wrap(0)", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(0), "ErrorZeroSharesWrap()");
  })

  .test("unwrap(0)", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(0), "ErrorZeroTokensUnwrap()");
  })

  .test("wrap() happy path", async (ctx) => {
    
    const { rebasableProxied, wrappedTokenStub } = ctx.contracts;
    const {user1, user2 } = ctx.accounts;
    const { rate, decimals, premintShares } = ctx.constants;

    const totalSupply = rate.mul(premintShares).div(decimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    const user1Shares = wei`100 ether`;
    const user1Tokens = rate.mul(user1Shares).div(decimals);

    assert.equalBN(await rebasableProxied.connect(user1).callStatic.wrap(user1Shares), user1Tokens);
    const tx = await rebasableProxied.connect(user1).wrap(user1Shares);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);

    assert.equal(await wrappedTokenStub.transferFromAddress(), user1.address);
    assert.equal(await wrappedTokenStub.transferFromTo(), rebasableProxied.address);
    assert.equalBN(await wrappedTokenStub.transferFromAmount(), user1Shares);
    
    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    const user2Shares = wei`50 ether`;
    const user2Tokens = rate.mul(user2Shares).div(decimals);

    assert.equalBN(await rebasableProxied.connect(user2).callStatic.wrap(user2Shares), user2Tokens);
    const tx2 = await rebasableProxied.connect(user2).wrap(user2Shares);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equal(await wrappedTokenStub.transferFromAddress(), user2.address);
    assert.equal(await wrappedTokenStub.transferFromTo(), rebasableProxied.address);
    assert.equalBN(await wrappedTokenStub.transferFromAmount(), user2Shares);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("wrap() with wrong oracle decimals", async (ctx) => {

    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await tokenRateOracleStub.setDecimals(0);
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(23), "ErrorInvalidRateDecimals(0)");

    await tokenRateOracleStub.setDecimals(19);
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(23), "ErrorInvalidRateDecimals(19)");
  })

  .test("wrap() with wrong oracle update time", async (ctx) => {

    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await tokenRateOracleStub.setUpdatedAt(0);
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(5), "ErrorWrongOracleUpdateTime()");
  })

  .test("wrap() with wrong oracle answer", async (ctx) => {

    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await tokenRateOracleStub.setLatestRoundDataAnswer(0);
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(21), "ErrorOracleAnswerIsNegative()");
  })

  .test("unwrap() happy path", async (ctx) => {

    const { rebasableProxied, wrappedTokenStub } = ctx.contracts;
    const {user1, user2 } = ctx.accounts;
    const { rate, decimals, premintShares } = ctx.constants;

    const totalSupply = BigNumber.from(rate).mul(premintShares).div(decimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    const user1SharesToWrap = wei`100 ether`;
    const user1SharesToUnwrap = wei`59 ether`;
    const user1TokensToUnwrap = rate.mul(user1SharesToUnwrap).div(decimals);

    const user1Shares = BigNumber.from(user1SharesToWrap).sub(user1SharesToUnwrap);
    const user1Tokens = BigNumber.from(rate).mul(user1Shares).div(decimals);

    const tx0 = await rebasableProxied.connect(user1).wrap(user1SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(user1).callStatic.unwrap(user1TokensToUnwrap), user1SharesToUnwrap);
    const tx = await rebasableProxied.connect(user1).unwrap(user1TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);
    assert.equal(await wrappedTokenStub.transferTo(), user1.address);
    assert.equalBN(await wrappedTokenStub.transferAmount(), user1SharesToUnwrap);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    const user2SharesToWrap = wei`145 ether`;
    const user2SharesToUnwrap = wei`14 ether`;
    const user2TokensToUnwrap = rate.mul(user2SharesToUnwrap).div(decimals);

    const user2Shares = BigNumber.from(user2SharesToWrap).sub(user2SharesToUnwrap);
    const user2Tokens = BigNumber.from(rate).mul(user2Shares).div(decimals);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    await rebasableProxied.connect(user2).wrap(user2SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(user2).callStatic.unwrap(user2TokensToUnwrap), user2SharesToUnwrap);
    const tx2 = await rebasableProxied.connect(user2).unwrap(user2TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equal(await wrappedTokenStub.transferTo(), user2.address);
    assert.equalBN(await wrappedTokenStub.transferAmount(), user2SharesToUnwrap);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("unwrap() with wrong oracle decimals", async (ctx) => {

    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await rebasableProxied.connect(user1).wrap(wei`2 ether`);

    await tokenRateOracleStub.setDecimals(0);
    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(23), "ErrorInvalidRateDecimals(0)");

    await tokenRateOracleStub.setDecimals(19);
    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(23), "ErrorInvalidRateDecimals(19)");
  })

  .test("unwrap() with wrong oracle update time", async (ctx) => {

    const { rebasableProxied, tokenRateOracleStub } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await rebasableProxied.connect(user1).wrap(wei`6 ether`);
    await tokenRateOracleStub.setUpdatedAt(0);
    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(wei`1 ether`), "ErrorWrongOracleUpdateTime()");
  })

  .test("unwrap() when no balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(wei`4 ether`), "ErrorNotEnoughBalance()");
  })

  .test("mintShares() happy path", async (ctx) => {

    const { rebasableProxied } = ctx.contracts;
    const {user1, user2, owner } = ctx.accounts;
    const { rate, decimals, premintShares, premintTokens } = ctx.constants;

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens);

    // user1
    const user1SharesToMint = wei`44 ether`;
    const user1TokensMinted = rate.mul(user1SharesToMint).div(decimals);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    assert.equalBN(await rebasableProxied.connect(owner).callStatic.mintShares(user1.address, user1SharesToMint), premintShares.add(user1SharesToMint));
    const tx0 = await rebasableProxied.connect(owner).mintShares(user1.address, user1SharesToMint);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1SharesToMint);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1TokensMinted);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1SharesToMint));
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens.add(user1TokensMinted));

    // // user2
    const user2SharesToMint = wei`75 ether`;
    const user2TokensMinted = rate.mul(user2SharesToMint).div(decimals);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    assert.equalBN(
        await rebasableProxied.connect(owner).callStatic.mintShares(user2.address, user2SharesToMint),
        premintShares.add(user1SharesToMint).add(user2SharesToMint)
    );
    const tx1 = await rebasableProxied.connect(owner).mintShares(user2.address, user2SharesToMint);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2SharesToMint);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2TokensMinted);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1SharesToMint).add(user2SharesToMint));
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens.add(user1TokensMinted).add(user2TokensMinted));
  })

  .test("burnShares() happy path", async (ctx) => {

    const { rebasableProxied } = ctx.contracts;
    const {user1, user2, owner } = ctx.accounts;
    const { rate, decimals, premintShares, premintTokens } = ctx.constants;

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens);

    // user1
    const user1SharesToMint = wei`12 ether`;
    const user1TokensMinted = rate.mul(user1SharesToMint).div(decimals);

    const user1SharesToBurn = wei`4 ether`;
    const user1TokensBurned = rate.mul(user1SharesToBurn).div(decimals);

    const user1Shares = BigNumber.from(user1SharesToMint).sub(user1SharesToBurn);
    const user1Tokens = user1TokensMinted.sub(user1TokensBurned);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    await rebasableProxied.connect(owner).mintShares(user1.address, user1SharesToMint);
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1SharesToMint);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1TokensMinted);

    await rebasableProxied.connect(owner).burnShares(user1.address, user1SharesToBurn);
    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens.add(user1Tokens));

    // // user2
    const user2SharesToMint = wei`64 ether`;
    const user2TokensMinted = rate.mul(user2SharesToMint).div(decimals);

    const user2SharesToBurn = wei`22 ether`;
    const user2TokensBurned = rate.mul(user2SharesToBurn).div(decimals);

    const user2Shares = BigNumber.from(user2SharesToMint).sub(user2SharesToBurn);
    const user2Tokens = user2TokensMinted.sub(user2TokensBurned);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    await rebasableProxied.connect(owner).mintShares(user2.address, user2SharesToMint);
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2SharesToMint);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2TokensMinted);
    await rebasableProxied.connect(owner).burnShares(user2.address, user2SharesToBurn);
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens.add(user1Tokens).add(user2Tokens));
  })

  .test("approve()", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, spender } = ctx.accounts;

    // validate initially allowance is zero
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      "0"
    );

    const amount = wei`1 ether`;

    // validate return value of the method
    assert.isTrue(
      await rebasableProxied.callStatic.approve(spender.address, amount)
    );

    // approve tokens
    const tx = await rebasableProxied.approve(spender.address, amount);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      amount,
    ]);

    // validate allowance was set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      amount
    );
  })

  .test("transfer() :: sender is zero address", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;

    const {
      accounts: { zero, recipient },
    } = ctx;
    await assert.revertsWith(
        rebasableProxied.connect(zero).transfer(recipient.address, wei`1 ether`),
        "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: recipient is zero address", async (ctx) => {
    const { zero, holder } = ctx.accounts;
    await assert.revertsWith(
      ctx.contracts.rebasableProxied.connect(holder).transfer(zero.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: zero balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    // transfer tokens
    await rebasableProxied.connect(holder).transfer(recipient.address, "0");

    // validate balance stays same
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);
  })

  .test("transfer() :: not enough balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = premintTokens.add(wei`1 ether`);

    // transfer tokens
    await assert.revertsWith(
        rebasableProxied.connect(holder).transfer(recipient.address, amount),
      "ErrorNotEnoughBalance()"
    );
  })

  .test("transfer()", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = wei`1 ether`;

    // transfer tokens
    const tx = await rebasableProxied
      .connect(holder)
      .transfer(recipient.address, amount);

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate balance was updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      premintTokens.sub(amount)
    );

    // validate total supply stays same
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens);
  })

  .test("transferFrom()", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // holder sets allowance for spender
    await rebasableProxied.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      wei.toBigNumber(initialAllowance).sub(amount),
    ]);

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance updated
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      wei.toBigNumber(initialAllowance).sub(amount)
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    const recipientBalance = await rebasableProxied.balanceOf(recipient.address);

    // validate recipient balance updated
    assert.equalBN(BigNumber.from(amount).sub(recipientBalance), "1");
  })

  .test("transferFrom() :: max allowance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = hre.ethers.constants.MaxUint256;

    // set allowance
    await rebasableProxied.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was not emitted
    await assert.notEmits(rebasableProxied, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    const recipientBalance = await rebasableProxied.balanceOf(recipient.address);
    assert.equalBN(BigNumber.from(amount).sub(recipientBalance), "1");
  })

  .test("transferFrom() :: not enough allowance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`0.9 ether`;

    // set allowance
    await rebasableProxied.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = wei`1 ether`;

    // transfer tokens
    await assert.revertsWith(
        rebasableProxied
        .connect(spender)
        .transferFrom(holder.address, recipient.address, amount),
      "ErrorNotEnoughAllowance()"
    );
  })

  .test("increaseAllowance() :: initial allowance is zero", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, spender } = ctx.accounts;

    // validate allowance before increasing
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      "0"
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await rebasableProxied.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      allowanceIncrease,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      allowanceIncrease
    );
  })

  .test("increaseAllowance() :: initial allowance is not zero", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await rebasableProxied.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await rebasableProxied.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    const expectedAllowance = wei
      .toBigNumber(initialAllowance)
      .add(allowanceIncrease);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      expectedAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      expectedAllowance
    );
  })

  .test("increaseAllowance() :: the increase is not zero", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await rebasableProxied.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    // increase allowance
    const tx = await rebasableProxied.increaseAllowance(spender.address, "0");

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      initialAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );
  })

  .test(
    "decreaseAllowance() :: decrease is greater than current allowance",
    async (ctx) => {
      const { rebasableProxied } = ctx.contracts;
      const { holder, spender } = ctx.accounts;

      // validate allowance before increasing
      assert.equalBN(
        await rebasableProxied.allowance(holder.address, spender.address),
        "0"
      );

      const allowanceDecrease = wei`1 ether`;

      // decrease allowance
      await assert.revertsWith(
        rebasableProxied.decreaseAllowance(spender.address, allowanceDecrease),
        "ErrorDecreasedAllowanceBelowZero()"
      );
    }
  )

  .group([wei`1 ether`, "0"], (allowanceDecrease) => [
    `decreaseAllowance() :: the decrease is ${allowanceDecrease} wei`,
    async (ctx) => {
      const { rebasableProxied } = ctx.contracts;
      const { holder, spender } = ctx.accounts;

      const initialAllowance = wei`2 ether`;

      // set initial allowance
      await rebasableProxied.approve(spender.address, initialAllowance);

      // validate allowance before increasing
      assert.equalBN(
        await rebasableProxied.allowance(holder.address, spender.address),
        initialAllowance
      );

      // decrease allowance
      const tx = await rebasableProxied.decreaseAllowance(
        spender.address,
        allowanceDecrease
      );

      const expectedAllowance = wei
        .toBigNumber(initialAllowance)
        .sub(allowanceDecrease);

      // validate Approval event was emitted
      await assert.emits(rebasableProxied, tx, "Approval", [
        holder.address,
        spender.address,
        expectedAllowance,
      ]);

      // validate allowance was updated correctly
      assert.equalBN(
        await rebasableProxied.allowance(holder.address, spender.address),
        expectedAllowance
      );
    },
  ])

  .test("bridgeMint() :: not owner", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { stranger } = ctx.accounts;

    await assert.revertsWith(
        rebasableProxied
        .connect(stranger)
        .mintShares(stranger.address, wei`1000 ether`),
      "ErrorNotBridge()"
    );
  })

  .group([wei`1000 ether`, "0"], (mintAmount) => [
    `bridgeMint() :: amount is ${mintAmount} wei`,
    async (ctx) => {
      const { rebasableProxied } = ctx.contracts;
      const { premintShares } = ctx.constants;
      const { recipient, owner } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await rebasableProxied.balanceOf(recipient.address), 0);

      // validate total supply before mint
      assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);

      // mint tokens
      const tx = await rebasableProxied
        .connect(owner)
        .mintShares(recipient.address, mintAmount);

      // validate Transfer event was emitted
      await assert.emits(rebasableProxied, tx, "Transfer", [
        hre.ethers.constants.AddressZero,
        recipient.address,
        mintAmount,
      ]);

      // validate balance was updated
      assert.equalBN(
        await rebasableProxied.sharesOf(recipient.address),
        mintAmount
      );

      // validate total supply was updated
      assert.equalBN(
        await rebasableProxied.getTotalShares(),
        premintShares.add(mintAmount)
      );
    },
  ])

  .test("bridgeBurn() :: not owner", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, stranger } = ctx.accounts;

    await assert.revertsWith(
        rebasableProxied.connect(stranger).burnShares(holder.address, wei`100 ether`),
      "ErrorNotBridge()"
    );
  })

  .test("bridgeBurn() :: amount exceeds balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { owner, stranger } = ctx.accounts;

    // validate stranger has no tokens
    assert.equalBN(await rebasableProxied.balanceOf(stranger.address), 0);

    await assert.revertsWith(
        rebasableProxied.connect(owner).burnShares(stranger.address, wei`100 ether`),
      "ErrorNotEnoughBalance()"
    );
  })

  .group([wei`10 ether`, "0"], (burnAmount) => [
    `bridgeBurn() :: amount is ${burnAmount} wei`,
    async (ctx) => {
      const { rebasableProxied } = ctx.contracts;
      const { premintShares } = ctx.constants;
      const { owner, holder } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await rebasableProxied.sharesOf(holder.address), premintShares);

      // validate total supply before mint
      assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);

      // burn tokens
      const tx = await rebasableProxied
        .connect(owner)
        .burnShares(holder.address, burnAmount);

      // validate Transfer event was emitted
      await assert.emits(rebasableProxied, tx, "Transfer", [
        holder.address,
        hre.ethers.constants.AddressZero,
        burnAmount,
      ]);

      const expectedBalanceAndTotalSupply = premintShares
        .sub(burnAmount);

      // validate balance was updated
      assert.equalBN(
        await rebasableProxied.sharesOf(holder.address),
        expectedBalanceAndTotalSupply
      );

      // validate total supply was updated
      assert.equalBN(
        await rebasableProxied.getTotalShares(),
        expectedBalanceAndTotalSupply
      );
    },
  ])

  .run();

async function ctxFactory() {
    const name = "StETH Test Token";
    const symbol = "StETH";
    const decimalsToSet = 16;
    const decimals = BigNumber.from(10).pow(decimalsToSet);
    const rate = BigNumber.from('12').pow(decimalsToSet - 1);
    const premintShares = wei.toBigNumber(wei`100 ether`);
    const premintTokens = BigNumber.from(rate).mul(premintShares).div(decimals);

    const [
        deployer,
        owner,
        recipient,
        spender,
        holder,
        stranger,
        user1,
        user2
    ] = await hre.ethers.getSigners();

    const wrappedTokenStub = await new ERC20Stub__factory(deployer).deploy(); 
    const tokenRateOracleStub = await new TokenRateOracleStub__factory(deployer).deploy(); 
    const rebasableTokenImpl = await new ERC20Rebasable__factory(deployer).deploy(
      name,
      symbol,
      decimalsToSet,
      wrappedTokenStub.address,
      tokenRateOracleStub.address,
      owner.address
    );

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [hre.ethers.constants.AddressZero],
    });

    const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

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
      holder
    );

    await tokenRateOracleStub.setDecimals(decimalsToSet);
    await tokenRateOracleStub.setLatestRoundDataAnswer(rate);
    await tokenRateOracleStub.setUpdatedAt(1000);

    await rebasableProxied.connect(owner).mintShares(holder.address, premintShares);

    return {
      accounts: { deployer, owner, recipient, spender, holder, stranger, zero, user1, user2 },
      constants: { name, symbol, decimalsToSet, decimals, premintShares, premintTokens, rate },
      contracts: { rebasableProxied, wrappedTokenStub, tokenRateOracleStub }
    };
}
