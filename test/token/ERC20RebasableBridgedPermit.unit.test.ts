import hre from "hardhat";
import { assert } from "chai";
import { BigNumber } from "ethers";
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { getBlockTimestamp } from "../../utils/testing/helpers";
import {
  erc20RebasableBridgedPermitUnderProxy,
  tokenRateOracleUnderProxy
} from "../../utils/testing/contractsFactory";
import {
  OssifiableProxy__factory,
  ERC20BridgedPermit__factory,
  ERC20RebasableBridgedPermit__factory,
  TokenRateOracle__factory
} from "../../typechain";

unit("ERC20RebasableBridgedPermit", ctxFactory)
  .test("constructor() :: zero params", async (ctx) => {
    const {
      deployer,
      stranger,
      zero,
      owner,
      messenger,
      l1TokenRatePusher
    } = ctx.accounts;

    const {
      tokenRateOutdatedDelay,
      maxAllowedL2ToL1ClockLag,
      maxAllowedTokenRateDeviationPerDay
    } = ctx.constants;

    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
      messenger.address,
      owner.address,
      l1TokenRatePusher.address,
      tokenRateOutdatedDelay,
      maxAllowedL2ToL1ClockLag,
      maxAllowedTokenRateDeviationPerDay,
      BigNumber.from(86400*3),
      BigNumber.from(3600)
    );

    await assert.revertsWith(new ERC20RebasableBridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      0,
      stranger.address,
      tokenRateOracle.address,
      stranger.address
    ), "ErrorZeroDecimals()");

    await assert.revertsWith(new ERC20RebasableBridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      18,
      zero.address,
      tokenRateOracle.address,
      stranger.address,
    ), "ErrorZeroAddressTokenToWrapFrom()");

    await assert.revertsWith(new ERC20RebasableBridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      18,
      stranger.address,
      zero.address,
      stranger.address,
    ), "ErrorZeroAddressTokenRateOracle()");

    await assert.revertsWith(new ERC20RebasableBridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      18,
      stranger.address,
      tokenRateOracle.address,
      zero.address,
    ), "ErrorZeroAddressL2ERC20TokenBridge()");
  })

  .test("initial state", async (ctx) => {
    const { rebasableProxied, wrappedToken, tokenRateOracle } = ctx.contracts;
    const { name, symbol, version, decimals } = ctx.constants;
    const { owner } = ctx.accounts;
    const [, eip712Name, eip712Version, , , ,] = await rebasableProxied.eip712Domain();
    assert.equal(eip712Name, name);
    assert.equal(eip712Version, version);
    assert.equal(await rebasableProxied.name(), name);
    assert.equal(await rebasableProxied.symbol(), symbol)
    assert.equalBN(await rebasableProxied.decimals(), decimals)
    assert.equal(await rebasableProxied.TOKEN_TO_WRAP_FROM(), wrappedToken.address);
    assert.equal(await rebasableProxied.TOKEN_RATE_ORACLE(), tokenRateOracle.address);
    assert.equal(await rebasableProxied.L2_ERC20_TOKEN_BRIDGE(), owner.address);
  })

  .test("initialize() :: petrified version", async (ctx) => {
    const { deployer, owner, zero, messenger, l1TokenRatePusher } = ctx.accounts;
    const { decimals } = ctx.constants;

    // deploy new implementation
    const wrappedToken = await new ERC20BridgedPermit__factory(deployer).deploy(
      "WsETH Test Token",
      "WsETH",
      "1",
      decimals,
      owner.address
    );
    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
      messenger.address,
      owner.address,
      l1TokenRatePusher.address,
      86400,
      86400,
      500,
      86400*3,
      3600
    );
    const rebasableTokenImpl = await new ERC20RebasableBridgedPermit__factory(deployer).deploy(
      "stETH Test Token",
      "stETH",
      "1",
      10,
      wrappedToken.address,
      tokenRateOracle.address,
      owner.address
    );

    const petrifiedVersionMark = hre.ethers.constants.MaxUint256;
    assert.equalBN(await rebasableTokenImpl.getContractVersion(), petrifiedVersionMark);

    await assert.revertsWith(
      rebasableTokenImpl.initialize("name", "symbol", "version"),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("initialize() :: don't allow to initialize with empty metadata", async (ctx) => {
    const { deployer, owner, zero, messenger, l1TokenRatePusher } = ctx.accounts;
    const { decimals, name, symbol, version } = ctx.constants;

    // deploy new implementation
    const wrappedToken = await new ERC20BridgedPermit__factory(deployer).deploy(
      "WsETH Test Token",
      "WsETH",
      "1",
      decimals,
      owner.address
    );
    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
      messenger.address,
      owner.address,
      l1TokenRatePusher.address,
      86400,
      86400,
      500,
      86400*3,
      3600
    );
    const rebasableTokenImpl = await new ERC20RebasableBridgedPermit__factory(deployer).deploy(
      "name",
      "symbol",
      "1",
      10,
      wrappedToken.address,
      tokenRateOracle.address,
      owner.address
    );

    await assert.revertsWith(
      new OssifiableProxy__factory(deployer).deploy(
        rebasableTokenImpl.address,
        deployer.address,
        ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
          "",
          symbol,
          version
        ])
      ),
      "ErrorNameIsEmpty()"
    );
    await assert.revertsWith(
      new OssifiableProxy__factory(deployer).deploy(
        rebasableTokenImpl.address,
        deployer.address,
        ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
          name,
          "",
          version
        ])
      ),
      "ErrorSymbolIsEmpty()"
    );
  })

  .test("initialize() :: don't allow to initialize twice", async (ctx) => {
    const { deployer, owner, zero, holder, messenger, l1TokenRatePusher } = ctx.accounts;
    const { decimals, name, symbol, version } = ctx.constants;

    // deploy new implementation
    const wrappedToken = await new ERC20BridgedPermit__factory(deployer).deploy(
      "WsETH Test Token",
      "WsETH",
      "1",
      decimals,
      owner.address
    );
    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
      messenger.address,
      owner.address,
      l1TokenRatePusher.address,
      86400,
      86400,
      500,
      86400*3,
      3600
    );
    const rebasableTokenImpl = await new ERC20RebasableBridgedPermit__factory(deployer).deploy(
      "name",
      "symbol",
      "1",
      10,
      wrappedToken.address,
      tokenRateOracle.address,
      owner.address
    );

    const l2TokensProxy = await new OssifiableProxy__factory(deployer).deploy(
      rebasableTokenImpl.address,
      deployer.address,
      ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
        version
      ])
    );

    const rebasableProxied = ERC20RebasableBridgedPermit__factory.connect(
      l2TokensProxy.address,
      holder
    );

    assert.equalBN(await rebasableProxied.getContractVersion(), 1);

    await assert.revertsWith(
      rebasableProxied.initialize(name, symbol, version),
      "NonZeroContractVersionOnInit()"
    );
  })

  .test("decimals() :: has the same value as is in constructor", async (ctx) =>
    assert.equalBN(await ctx.contracts.rebasableProxied.decimals(), ctx.constants.decimals)
  )

  .test("getTotalShares() :: returns preminted amount", async (ctx) => {
    const { premintShares } = ctx.constants;
    assert.equalBN(await ctx.contracts.rebasableProxied.getTotalShares(), premintShares);
  })

  .test("wrap() :: revert if wrap 0 wstETH", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(0), "ErrorZeroSharesWrap()");
  })

  .test("wrap() :: when no balance", async (ctx) => {
    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await wrappedToken.connect(user1).approve(rebasableProxied.address, 1000);
    await assert.revertsWith(rebasableProxied.connect(user1).wrap(2), "ErrorNotEnoughBalance()");
  })

  .test("wrap() :: happy path", async (ctx) => {

    const { rebasableProxied, wrappedToken, tokenRateOracle } = ctx.contracts;
    const { user1, user2, owner, zero } = ctx.accounts;
    const { tokenRate, tenPowDecimals, premintShares } = ctx.constants;

    await tokenRateOracle.connect(owner).updateRate(tokenRate, 1000);

    const totalSupply = tokenRate.mul(premintShares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1
    const user1Shares = wei`100 ether`;
    const user1Tokens = tokenRate.mul(user1Shares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1Tokens);
    await wrappedToken.connect(user1).approve(rebasableProxied.address, user1Shares);

    assert.equalBN(await rebasableProxied.connect(user1).callStatic.wrap(user1Shares), user1Tokens);
    const tx = await rebasableProxied.connect(user1).wrap(user1Shares);

    await assert.emits(rebasableProxied, tx, "Transfer", [zero.address, user1.address, user1Tokens]);
    await assert.emits(rebasableProxied, tx, "TransferShares", [zero.address, user1.address, user1Shares]);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(user1Shares));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    const user2Shares = wei`50 ether`;
    const user2Tokens = tokenRate.mul(user2Shares).div(tenPowDecimals);

    await wrappedToken.connect(owner).bridgeMint(user2.address, user2Tokens);
    await wrappedToken.connect(user2).approve(rebasableProxied.address, user2Shares);

    assert.equalBN(await rebasableProxied.connect(user2).callStatic.wrap(user2Shares), user2Tokens);
    const tx2 = await rebasableProxied.connect(user2).wrap(user2Shares);

    await assert.emits(rebasableProxied, tx2, "Transfer", [zero.address, user2.address, user2Tokens]);
    await assert.emits(rebasableProxied, tx2, "TransferShares", [zero.address, user2.address, user2Shares]);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(BigNumber.from(user1Shares).add(user2Shares)));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("unwrap() :: revert if unwrap 0 wstETH", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(0), "ErrorZeroTokensUnwrap()");
  })

  .test("unwrap() :: when no balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;

    await assert.revertsWith(rebasableProxied.connect(user1).unwrap(wei`4 ether`), "ErrorNotEnoughBalance()");
  })

  .test("unwrap() :: events", async (ctx) => {
    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { user1, owner, zero } = ctx.accounts;
    const { tokenRate, tenPowDecimals } = ctx.constants;

    const user1SharesToWrap = BigNumber.from(10).pow(30);
    const user1TokensToUnwrap = BigNumber.from('764035550674393190');
    const user1SharesToUnwrap = (user1TokensToUnwrap).mul(tenPowDecimals).div(BigNumber.from(tokenRate));

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1SharesToWrap);
    await wrappedToken.connect(user1).approve(rebasableProxied.address, user1SharesToWrap);
    await rebasableProxied.connect(user1).wrap(user1SharesToWrap);

    const tx = await rebasableProxied.connect(user1).unwrap(user1TokensToUnwrap);

    await assert.emits(rebasableProxied, tx, "Transfer", [user1.address, zero.address, user1TokensToUnwrap]);
    await assert.emits(rebasableProxied, tx, "TransferShares", [user1.address, zero.address, user1SharesToUnwrap]);
  })

  .test("unwrap() :: happy path", async (ctx) => {

    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { user1, user2, owner } = ctx.accounts;
    const { tokenRate, tenPowDecimals, premintShares } = ctx.constants;

    const totalSupply = BigNumber.from(tokenRate).mul(premintShares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    const user1SharesToWrap = wei`100 ether`;
    const user1SharesToUnwrap = wei`59 ether`;
    const user1TokensToUnwrap = tokenRate.mul(user1SharesToUnwrap).div(tenPowDecimals);

    const user1Shares = BigNumber.from(user1SharesToWrap).sub(user1SharesToUnwrap);
    const user1Tokens = BigNumber.from(tokenRate).mul(user1Shares).div(tenPowDecimals);

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1SharesToWrap);
    await wrappedToken.connect(user1).approve(rebasableProxied.address, user1SharesToWrap);

    const tx0 = await rebasableProxied.connect(user1).wrap(user1SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(user1).callStatic.unwrap(user1TokensToUnwrap), user1SharesToUnwrap);
    const tx = await rebasableProxied.connect(user1).unwrap(user1TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(user1Shares));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    const user2SharesToWrap = wei`145 ether`;
    const user2SharesToUnwrap = wei`14 ether`;
    const user2TokensToUnwrap = tokenRate.mul(user2SharesToUnwrap).div(tenPowDecimals);

    const user2Shares = BigNumber.from(user2SharesToWrap).sub(user2SharesToUnwrap);
    const user2Tokens = BigNumber.from(tokenRate).mul(user2Shares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    await wrappedToken.connect(owner).bridgeMint(user2.address, user2SharesToWrap);
    await wrappedToken.connect(user2).approve(rebasableProxied.address, user2SharesToWrap);

    await rebasableProxied.connect(user2).wrap(user2SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(user2).callStatic.unwrap(user2TokensToUnwrap), user2SharesToUnwrap);
    const tx2 = await rebasableProxied.connect(user2).unwrap(user2TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(BigNumber.from(user1Shares).add(user2Shares)));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("unwrapShares() :: revert if unwrap 0 shares", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).unwrapShares(0), "ErrorZeroSharesUnwrap()");
  })

  .test("unwrapShares() :: not enough balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).unwrapShares(wei`4 ether`), "ErrorNotEnoughBalance()");
  })

  .test("unwrapShares() :: happy path", async (ctx) => {

    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { user1, owner } = ctx.accounts;
    const { tokenRate, tenPowDecimals, premintShares } = ctx.constants;

    const totalSupply = BigNumber.from(tokenRate).mul(premintShares).div(tenPowDecimals);

    // user1
    const user1SharesToWrap = 10;
    const user1SharesToUnwrap = user1SharesToWrap;

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1SharesToWrap);
    await wrappedToken.connect(user1).approve(rebasableProxied.address, user1SharesToWrap);
    await rebasableProxied.connect(user1).wrap(user1SharesToWrap);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1SharesToWrap);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(user1SharesToWrap));

    await rebasableProxied.connect(user1).unwrapShares(user1SharesToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares);
  })

  .test("bridgeWrap() :: revert if not bridge", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, user2 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).bridgeWrap(user2.address, 10), "ErrorNotBridge()");
  })

  .test("bridgeWrap() :: revert if wrap 0 wstETH", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, owner } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(owner).bridgeWrap(user1.address, 0), "ErrorZeroSharesWrap()");
  })

  .test("bridgeWrap() :: when no balance", async (ctx) => {
    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { owner, user1 } = ctx.accounts;

    await wrappedToken.connect(owner).approve(rebasableProxied.address, 1000);
    await assert.revertsWith(rebasableProxied.connect(owner).bridgeWrap(user1.address, 2), "ErrorNotEnoughBalance()");
  })

  .test("bridgeWrap() :: happy path", async (ctx) => {

    const { rebasableProxied, wrappedToken, tokenRateOracle } = ctx.contracts;
    const { user1, user2, owner, zero } = ctx.accounts;
    const { tokenRate, tenPowDecimals, premintShares } = ctx.constants;

    await wrappedToken.connect(owner).bridgeMint(owner.address, wei`1000 ether`);
    await tokenRateOracle.connect(owner).updateRate(tokenRate, 1000);

    const totalSupply = tokenRate.mul(premintShares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1
    const user1Shares = wei`100 ether`;
    const user1Tokens = tokenRate.mul(user1Shares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1Tokens);
    await wrappedToken.connect(owner).approve(rebasableProxied.address, user1Shares);

    assert.equalBN(await rebasableProxied.connect(owner).callStatic.bridgeWrap(user1.address, user1Shares), user1Tokens);
    const tx = await rebasableProxied.connect(owner).bridgeWrap(user1.address, user1Shares);

    await assert.emits(rebasableProxied, tx, "Transfer", [zero.address, user1.address, user1Tokens]);
    await assert.emits(rebasableProxied, tx, "TransferShares", [zero.address, user1.address, user1Shares]);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(user1Shares));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    const user2Shares = wei`50 ether`;
    const user2Tokens = tokenRate.mul(user2Shares).div(tenPowDecimals);

    await wrappedToken.connect(owner).bridgeMint(user2.address, user2Tokens);
    await wrappedToken.connect(owner).approve(rebasableProxied.address, user2Shares);

    assert.equalBN(await rebasableProxied.connect(owner).callStatic.bridgeWrap(user2.address, user2Shares), user2Tokens);
    const tx2 = await rebasableProxied.connect(owner).bridgeWrap(user2.address, user2Shares);

    await assert.emits(rebasableProxied, tx2, "Transfer", [zero.address, user2.address, user2Tokens]);
    await assert.emits(rebasableProxied, tx2, "TransferShares", [zero.address, user2.address, user2Shares]);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(BigNumber.from(user1Shares).add(user2Shares)));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), BigNumber.from(premintShares).add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("bridgeUnwrap() :: revert if not bridge", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, user2 } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(user1).bridgeUnwrap(user2.address, 10), "ErrorNotBridge()");
  })

  .test("bridgeUnwrap() :: revert if unwrap 0 wstETH", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, owner } = ctx.accounts;
    await assert.revertsWith(rebasableProxied.connect(owner).bridgeUnwrap(user1.address, 0), "ErrorZeroTokensUnwrap()");
  })

  .test("bridgeUnwrap() :: when no balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { user1, owner } = ctx.accounts;

    await assert.revertsWith(rebasableProxied.connect(owner).bridgeUnwrap(user1.address, wei`4 ether`), "ErrorNotEnoughBalance()");
  })

  .test("bridgeUnwrap() :: happy path", async (ctx) => {

    const { rebasableProxied, wrappedToken } = ctx.contracts;
    const { user1, user2, owner } = ctx.accounts;
    const { tokenRate, tenPowDecimals, premintShares } = ctx.constants;

    const totalSupply = BigNumber.from(tokenRate).mul(premintShares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares);
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply);

    // user1

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), 0);

    const user1SharesToWrap = wei`100 ether`;
    const user1SharesToUnwrap = wei`59 ether`;
    const user1TokensToUnwrap = tokenRate.mul(user1SharesToUnwrap).div(tenPowDecimals);

    const user1Shares = BigNumber.from(user1SharesToWrap).sub(user1SharesToUnwrap);
    const user1Tokens = BigNumber.from(tokenRate).mul(user1Shares).div(tenPowDecimals);

    await wrappedToken.connect(owner).bridgeMint(user1.address, user1SharesToWrap);
    await wrappedToken.connect(user1).approve(rebasableProxied.address, user1SharesToWrap);

    const tx0 = await rebasableProxied.connect(user1).wrap(user1SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(owner).callStatic.bridgeUnwrap(user1.address, user1TokensToUnwrap), user1SharesToUnwrap);
    const tx = await rebasableProxied.connect(owner).bridgeUnwrap(user1.address, user1TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user1.address), user1Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user1.address), user1Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(user1Shares));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens));

    // user2
    const user2SharesToWrap = wei`145 ether`;
    const user2SharesToUnwrap = wei`14 ether`;
    const user2TokensToUnwrap = tokenRate.mul(user2SharesToUnwrap).div(tenPowDecimals);

    const user2Shares = BigNumber.from(user2SharesToWrap).sub(user2SharesToUnwrap);
    const user2Tokens = BigNumber.from(tokenRate).mul(user2Shares).div(tenPowDecimals);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), 0);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), 0);

    await wrappedToken.connect(owner).bridgeMint(user2.address, user2SharesToWrap);
    await wrappedToken.connect(user2).approve(rebasableProxied.address, user2SharesToWrap);

    await rebasableProxied.connect(user2).wrap(user2SharesToWrap);
    assert.equalBN(await rebasableProxied.connect(owner).callStatic.bridgeUnwrap(user2.address, user2TokensToUnwrap), user2SharesToUnwrap);
    const tx2 = await rebasableProxied.connect(owner).bridgeUnwrap(user2.address, user2TokensToUnwrap);

    assert.equalBN(await rebasableProxied.sharesOf(user2.address), user2Shares);
    assert.equalBN(await rebasableProxied.balanceOf(user2.address), user2Tokens);
    assert.equalBN(await wrappedToken.balanceOf(rebasableProxied.address), premintShares.add(BigNumber.from(user1Shares).add(user2Shares)));

    // common state changes
    assert.equalBN(await rebasableProxied.getTotalShares(), premintShares.add(user1Shares).add(user2Shares));
    assert.equalBN(await rebasableProxied.totalSupply(), totalSupply.add(user1Tokens).add(user2Tokens));
  })

  .test("approve() :: events", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { holder, spender } = ctx.accounts;
    const amount = wei`1 ether`;

    const tx = await rebasableProxied.approve(spender.address, amount);
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      amount,
    ]);
  })

  .test("approve() :: happy path", async (ctx) => {
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

  .test("transfer() :: happy path", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = wei`1 ether`;
    const sharesToTransfer = await rebasableProxied.getSharesByTokens(amount);

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

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesToTransfer,
    ]);

    // validate balance was updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      premintTokens.sub(amount)
    );

    // validate total supply stays same
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens);
  })


  .test("transferShares() :: sender is zero address", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;

    const {
      accounts: { zero, recipient },
    } = ctx;
    await assert.revertsWith(
      rebasableProxied.connect(zero).transferShares(recipient.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transferShares() :: recipient is zero address", async (ctx) => {
    const { zero, holder } = ctx.accounts;
    await assert.revertsWith(
      ctx.contracts.rebasableProxied.connect(holder).transferShares(zero.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transferShares() :: zero balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    // transfer tokens
    await rebasableProxied.connect(holder).transferShares(recipient.address, "0");

    // validate balance stays same
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);
  })

  .test("transferShares() :: not enough balance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const amount = premintTokens.add(wei`1 ether`);

    // transfer tokens
    await assert.revertsWith(
      rebasableProxied.connect(holder).transferShares(recipient.address, amount),
      "ErrorNotEnoughBalance()"
    );
  })

  .test("transferShares() :: happy path", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    //
    const sharesToTransfer = wei`1 ether`;
    const tokensToTransfer = await rebasableProxied.getTokensByShares(sharesToTransfer);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(holder)
      .transferShares(recipient.address, sharesToTransfer);

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      tokensToTransfer,
    ]);

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesToTransfer,
    ]);

    // validate balance was updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      premintTokens.sub(tokensToTransfer)
    );

    // validate total supply stays same
    assert.equalBN(await rebasableProxied.totalSupply(), premintTokens);
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

    const tokensAmount = wei`1 ether`;
    const sharesAmount = await rebasableProxied.getSharesByTokens(tokensAmount);

    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);
    const recepientBalanceBefore = await rebasableProxied.balanceOf(recipient.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferFrom(holder.address, recipient.address, tokensAmount);

    // validate Approval event was not emitted
    await assert.notEmits(rebasableProxied, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      tokensAmount,
    ]);

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesAmount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(tokensAmount)
    );

    // validate recipient balance updated
    const recipientBalanceAfter = await rebasableProxied.balanceOf(recipient.address);
    const balanceDelta = recipientBalanceAfter.sub(recepientBalanceBefore);
    const oneTwoWei = wei.toBigNumber(tokensAmount).sub(balanceDelta);
    assert.isTrue(oneTwoWei.gte(0) && oneTwoWei.lte(2));
  })

  .test("transferFrom() :: happy path", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const tokensAmountToApprove = wei`2 ether`;
    const tokensAmountToTransfer = wei`1 ether`;
    const sharesAmountToTransfer = await rebasableProxied.getSharesByTokens(tokensAmountToTransfer);

    // holder sets allowance for spender
    await rebasableProxied.approve(spender.address, tokensAmountToApprove);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      tokensAmountToApprove
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const recepientBalanceBefore = await rebasableProxied.balanceOf(recipient.address);
    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferFrom(holder.address, recipient.address, tokensAmountToTransfer);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      wei.toBigNumber(tokensAmountToApprove).sub(tokensAmountToTransfer),
    ]);

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      tokensAmountToTransfer,
    ]);

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesAmountToTransfer,
    ]);

    // validate allowance updated
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      wei.toBigNumber(tokensAmountToApprove).sub(tokensAmountToTransfer)
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(tokensAmountToTransfer)
    );

    // validate recipient balance updated
    const recipientBalanceAfter = await rebasableProxied.balanceOf(recipient.address);
    const balanceDelta = recipientBalanceAfter.sub(recepientBalanceBefore);
    const oneTwoWei = wei.toBigNumber(tokensAmountToTransfer).sub(balanceDelta);
    assert.isTrue(oneTwoWei.gte(0) && oneTwoWei.lte(2));
  })

  .test("transferSharesFrom() :: not enough allowance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { recipient, holder, spender } = ctx.accounts;

    const sharesAmount = wei`1 ether`;
    const tokenAllowance = await rebasableProxied.getTokensByShares(wei.toBigNumber(sharesAmount).sub(1000));

    // set allowance
    await rebasableProxied.approve(recipient.address, tokenAllowance);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, recipient.address),
      tokenAllowance
    );

    // transfer tokens
    await assert.revertsWith(
      rebasableProxied
        .connect(spender)
        .transferSharesFrom(holder.address, recipient.address, sharesAmount),
      "ErrorNotEnoughAllowance()"
    );
  })

  .test("transferSharesFrom() :: max allowance", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const tokenAllowance = hre.ethers.constants.MaxUint256;

    // set allowance
    await rebasableProxied.approve(spender.address, tokenAllowance);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      tokenAllowance
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);

    const sharesAmount = wei`1 ether`;
    const tokensAmount = await rebasableProxied.getTokensByShares(sharesAmount);

    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferSharesFrom(holder.address, recipient.address, sharesAmount);

    // validate Approval event was not emitted
    await assert.notEmits(rebasableProxied, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      tokensAmount,
    ]);

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesAmount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      tokenAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(tokensAmount)
    );

    // validate recipient balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(recipient.address),
      tokensAmount
    );
  })

  .test("transferSharesFrom() :: happy path", async (ctx) => {
    const { rebasableProxied } = ctx.contracts;
    const { premintTokens } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const sharesAmountToApprove = wei`2 ether`;
    const sharesAmountToTransfer = wei`1 ether`;

    const tokensAmountToApprove = await rebasableProxied.getTokensByShares(sharesAmountToApprove);
    const tokensAmountToTransfer = await rebasableProxied.getTokensByShares(sharesAmountToTransfer);


    // holder sets allowance for spender
    await rebasableProxied.approve(spender.address, tokensAmountToApprove);

    // validate allowance is set
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      tokensAmountToApprove
    );

    // validate balance before transfer
    assert.equalBN(await rebasableProxied.balanceOf(holder.address), premintTokens);


    const holderBalanceBefore = await rebasableProxied.balanceOf(holder.address);

    // transfer tokens
    const tx = await rebasableProxied
      .connect(spender)
      .transferSharesFrom(holder.address, recipient.address, sharesAmountToTransfer);

    // validate Approval event was emitted
    await assert.emits(rebasableProxied, tx, "Approval", [
      holder.address,
      spender.address,
      tokensAmountToApprove.sub(tokensAmountToTransfer),
    ]);

    // validate Transfer event was emitted
    await assert.emits(rebasableProxied, tx, "Transfer", [
      holder.address,
      recipient.address,
      tokensAmountToTransfer,
    ]);

    await assert.emits(rebasableProxied, tx, "TransferShares", [
      holder.address,
      recipient.address,
      sharesAmountToTransfer,
    ]);

    // validate allowance updated
    assert.equalBN(
      await rebasableProxied.allowance(holder.address, spender.address),
      tokensAmountToApprove.sub(tokensAmountToTransfer)
    );

    // validate holder balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(holder.address),
      holderBalanceBefore.sub(tokensAmountToTransfer)
    );

    // validate recipient balance updated
    assert.equalBN(
      await rebasableProxied.balanceOf(recipient.address),
      tokensAmountToTransfer
    );
  })
  .run();

async function ctxFactory() {
  /// ---------------------------
  /// constants
  /// ---------------------------
  const name = "StETH Test Token";
  const symbol = "StETH";
  const version = "1";
  const decimals = BigNumber.from(27);
  const tenPowDecimals = BigNumber.from(10).pow(decimals);
  const tokenRate = BigNumber.from('1164454276599657236000000000'); // value taken from real contact on 23.04.24
  const tokenRateOutdatedDelay = BigNumber.from(86400);             // 1 day
  const maxAllowedL2ToL1ClockLag = BigNumber.from(86400);           // 1 day
  const maxAllowedTokenRateDeviationPerDay = BigNumber.from(500);   // 5%
  const premintShares = wei.toBigNumber(wei`100 ether`);
  const premintTokens = tokenRate.mul(premintShares).div(tenPowDecimals);
  const provider = await hre.ethers.provider;
  const blockTimestamp = await getBlockTimestamp(provider, 0);

  const [
    deployer,
    owner,
    recipient,
    spender,
    holder,
    stranger,
    user1,
    user2,
    messenger,
    l1TokenRatePusher
  ] = await hre.ethers.getSigners();

  const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

  /// ---------------------------
  /// contracts
  /// ---------------------------
  const wrappedToken = await new ERC20BridgedPermit__factory(deployer).deploy(
    "WsETH Test Token",
    "WsETH",
    version,
    decimals,
    owner.address
  );

  const { tokenRateOracle } = await tokenRateOracleUnderProxy(
    deployer,
    messenger.address,
    owner.address,
    l1TokenRatePusher.address,
    tokenRateOutdatedDelay,
    maxAllowedL2ToL1ClockLag,
    maxAllowedTokenRateDeviationPerDay,
    BigNumber.from(86400*3),
    BigNumber.from(3600),
    tokenRate,
    blockTimestamp
  )

  const rebasableProxied = await erc20RebasableBridgedPermitUnderProxy(
    deployer,
    holder,
    name,
    symbol,
    version,
    decimals,
    tokenRateOracle,
    wrappedToken,
    owner.address,
  );

  /// ---------------------------
  /// setup
  /// ---------------------------
  await wrappedToken.connect(owner).bridgeMint(holder.address, premintTokens);
  await wrappedToken.connect(holder).approve(rebasableProxied.address, premintShares);
  await rebasableProxied.connect(holder).wrap(premintShares);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [hre.ethers.constants.AddressZero],
  });

  return {
    accounts: {
      deployer,
      owner,
      recipient,
      spender,
      holder,
      stranger,
      zero,
      user1,
      user2,
      messenger,
      l1TokenRatePusher
    },
    constants: {
      name,
      symbol,
      version,
      decimals,
      tenPowDecimals,
      premintShares,
      premintTokens,
      tokenRate,
      blockTimestamp,
      tokenRateOutdatedDelay,
      maxAllowedL2ToL1ClockLag,
      maxAllowedTokenRateDeviationPerDay
    },
    contracts: {
      rebasableProxied,
      wrappedToken,
      tokenRateOracle
    }
  };
}
