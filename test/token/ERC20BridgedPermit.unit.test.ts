import { assert } from "chai";
import hre from "hardhat";
import { BigNumber } from "ethers";
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { erc20BridgedPermitUnderProxy } from "../../utils/testing/contractsFactory";
import {
  ERC20BridgedPermit__factory,
  ERC20BridgedWithInitializerStub__factory,
  OssifiableProxy__factory,
} from "../../typechain";

unit("ERC20BridgedPermit", ctxFactory)

  .test("constructor() :: zero params", async (ctx) => {
    const { deployer, stranger, zero } = ctx.accounts;

    await assert.revertsWith(new ERC20BridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      0,
      stranger.address
    ), "ErrorZeroDecimals()");

    await assert.revertsWith(new ERC20BridgedPermit__factory(
      deployer
    ).deploy(
      "name",
      "symbol",
      "version",
      18,
      zero.address
    ), "ErrorZeroAddressBridge()");
  })

  .test("initial state", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { decimals, name, symbol, version, premint } = ctx.constants;
    const { owner } = ctx.accounts;
    const [, eip712Name, eip712Version, , , ,] = await erc20Bridged.eip712Domain();

    assert.equal(eip712Name, name);
    assert.equal(eip712Version, version);
    assert.equal(await erc20Bridged.name(), name);
    assert.equal(await erc20Bridged.symbol(), symbol);
    assert.equalBN(await erc20Bridged.decimals(), decimals);
    assert.equal(await erc20Bridged.bridge(), owner.address);
    assert.equalBN(await erc20Bridged.totalSupply(), premint);
  })

  .test("initialize() :: petrified", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const erc20BridgedImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "name",
      "symbol",
      "version",
      9,
      owner.address
    );

    const petrifiedVersionMark = hre.ethers.constants.MaxUint256;
    assert.equalBN(await erc20BridgedImpl.getContractVersion(), petrifiedVersionMark);

    // an early check of metadata won't allow to see NonZeroContractVersionOnInit() error
    await assert.revertsWith(
      erc20BridgedImpl.initialize("name", "symbol", "version"),
      "ErrorMetadataIsAlreadyInitialized()"
    );
  })

  .test("initialize() :: don't allow to initialize with empty metadata", async (ctx) => {
    const { deployer, owner } = ctx.accounts;
    const { name, symbol, version } = ctx.constants;

    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "wstETH",
      "wst",
      "1",
      9,
      owner.address
    );

    await assert.revertsWith(
      new OssifiableProxy__factory(deployer).deploy(
        l2TokenImpl.address,
        deployer.address,
        ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
          "",
          symbol,
          version
        ])
      ),
      "ErrorNameIsEmpty()"
    );
    await assert.revertsWith(
      new OssifiableProxy__factory(deployer).deploy(
        l2TokenImpl.address,
        deployer.address,
        ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
          name,
          "",
          version
        ])
      ),
      "ErrorSymbolIsEmpty()"
    );
  })

  .test("initialize() :: don't allow to initialize twice", async (ctx) => {
    const { deployer, owner, holder } = ctx.accounts;
    const { name, symbol, version } = ctx.constants;

    // deploy new implementation
    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "wstETH",
      "wst",
      "1",
      9,
      owner.address
    );

    const l2TokensProxy = await new OssifiableProxy__factory(deployer).deploy(
      l2TokenImpl.address,
      deployer.address,
      ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
        version
      ])
    );

    const erc20BridgedProxied = ERC20BridgedPermit__factory.connect(
      l2TokensProxy.address,
      holder
    );

    assert.equalBN(await erc20BridgedProxied.getContractVersion(), 2);

    await assert.revertsWith(
      erc20BridgedProxied.initialize(name, symbol, version),
      "ErrorMetadataIsAlreadyInitialized()"
    );
  })

  .test("finalizeUpgrade_v2() :: metadata uninitialized", async (ctx) => {
    const { deployer, owner } = ctx.accounts;
    const { name, version } = ctx.constants;

    // deploy new implementation
    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "name",
      "Symbol",
      "1",
      9,
      owner.address
    );

    await assert.revertsWith(new OssifiableProxy__factory(deployer).deploy(
      l2TokenImpl.address,
      deployer.address,
      ERC20BridgedPermit__factory.createInterface().encodeFunctionData("finalizeUpgrade_v2", [
        name,
        version
      ])
    ), "ErrorMetadataIsNotInitialized()");
  })

  .test("finalizeUpgrade_v2() :: metadata initialized", async (ctx) => {
    const { deployer, owner } = ctx.accounts;
    const { name, version } = ctx.constants;

    const l2TokenOldImpl = await new ERC20BridgedWithInitializerStub__factory(deployer).deploy(
      "name",
      "symbol",
      18,
      owner.address
    );

    const l2TokenProxy = await new OssifiableProxy__factory(deployer).deploy(
      l2TokenOldImpl.address,
      deployer.address,
      ERC20BridgedWithInitializerStub__factory.createInterface().encodeFunctionData("initializeERC20Metadata", [
        "name",
        "symbol"
      ])
    );

    const erc20BridgedProxied = ERC20BridgedPermit__factory.connect(
      l2TokenProxy.address,
      owner
    );

    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "name",
      "symbol",
      "1",
      18,
      owner.address
    );

    await l2TokenProxy.proxy__upgradeToAndCall(
      l2TokenImpl.address,
      ERC20BridgedPermit__factory.createInterface().encodeFunctionData("finalizeUpgrade_v2", [
        name,
        version
      ]),
      false
    );

    assert.equalBN(await erc20BridgedProxied.getContractVersion(), 2);

    // can't initialize after finalizeUpgrade_v2
    await assert.revertsWith(
      erc20BridgedProxied.initialize("name", "symbol", "version"),
      "ErrorMetadataIsAlreadyInitialized()"
    );
  })

  .test("initialize() :: ins't allowed to call instead of finalizeUpgrade_v2()", async (ctx) => {
    const { deployer, owner } = ctx.accounts;
    const { name, symbol, version } = ctx.constants;

    const l2TokenOldImpl = await new ERC20BridgedWithInitializerStub__factory(deployer).deploy(
      "name",
      "symbol",
      18,
      owner.address
    );

    const l2TokenProxy = await new OssifiableProxy__factory(deployer).deploy(
      l2TokenOldImpl.address,
      deployer.address,
      ERC20BridgedWithInitializerStub__factory.createInterface().encodeFunctionData("initializeERC20Metadata", [
        "name",
        "symbol"
      ])
    );

    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "name",
      "symbol",
      "1",
      18,
      owner.address
    );

    await assert.revertsWith(l2TokenProxy.proxy__upgradeToAndCall(
      l2TokenImpl.address,
      ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
        version
      ]),
      false
    ), "ErrorMetadataIsAlreadyInitialized()");
  })

  .test("approve()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, spender } = ctx.accounts;

    // validate initially allowance is zero
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      "0"
    );

    const amount = wei`1 ether`;

    // validate return value of the method
    assert.isTrue(
      await erc20Bridged.callStatic.approve(spender.address, amount)
    );

    // approve tokens
    const tx = await ctx.erc20Bridged.approve(spender.address, amount);

    // validate Approval event was emitted
    await assert.emits(ctx.erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      amount,
    ]);

    // validate allowance was set
    assert.equalBN(
      await ctx.erc20Bridged.allowance(holder.address, spender.address),
      amount
    );
  })

  .test("transfer() :: sender is zero address", async (ctx) => {
    const {
      accounts: { zero, recipient },
    } = ctx;
    await assert.revertsWith(
      ctx.erc20Bridged.connect(zero).transfer(recipient.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: recipient is zero address", async (ctx) => {
    const { zero, holder } = ctx.accounts;
    await assert.revertsWith(
      ctx.erc20Bridged.connect(holder).transfer(zero.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: zero balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    // transfer tokens
    await erc20Bridged.connect(holder).transfer(recipient.address, "0");

    // validate balance stays same
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);
  })

  .test("transfer() :: not enough balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei.toBigNumber(premint).add(wei`1 ether`);

    // transfer tokens
    await assert.revertsWith(
      erc20Bridged.connect(holder).transfer(recipient.address, amount),
      "ErrorNotEnoughBalance()"
    );
  })

  .test("transfer()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    const tx = await erc20Bridged
      .connect(holder)
      .transfer(recipient.address, amount);

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate balance was updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      wei.toBigNumber(premint).sub(amount)
    );

    // validate total supply stays same
    assert.equalBN(await erc20Bridged.totalSupply(), premint);
  })

  .test("transferFrom()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // holder sets allowance for spender
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await erc20Bridged.balanceOf(holder.address);

    // transfer tokens
    const tx = await erc20Bridged
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was emitted
    await assert.emits(erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      wei.toBigNumber(initialAllowance).sub(amount),
    ]);

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance updated
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      wei.toBigNumber(initialAllowance).sub(amount)
    );

    // validate holder balance updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), amount);
  })

  .test("transferFrom() :: max allowance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = hre.ethers.constants.MaxUint256;

    // set allowance
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await erc20Bridged.balanceOf(holder.address);

    // transfer tokens
    const tx = await erc20Bridged
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was not emitted
    await assert.notEmits(erc20Bridged, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), amount);
  })

  .test("transferFrom() :: not enough allowance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`0.9 ether`;

    // set allowance
    await erc20Bridged.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    await assert.revertsWith(
      erc20Bridged
        .connect(spender)
        .transferFrom(holder.address, recipient.address, amount),
      "ErrorNotEnoughAllowance()"
    );
  })

  .test("bridgeMint() :: not owner", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { stranger } = ctx.accounts;

    await assert.revertsWith(
      erc20Bridged
        .connect(stranger)
        .bridgeMint(stranger.address, wei`1000 ether`),
      "ErrorNotBridge()"
    );
  })

  .group([wei`1000 ether`, "0"], (mintAmount) => [
    `bridgeMint() :: amount is ${mintAmount} wei`,
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { premint } = ctx.constants;
      const { recipient, owner } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await erc20Bridged.balanceOf(recipient.address), 0);

      // validate total supply before mint
      assert.equalBN(await erc20Bridged.totalSupply(), premint);

      // mint tokens
      const tx = await erc20Bridged
        .connect(owner)
        .bridgeMint(recipient.address, mintAmount);

      // validate Transfer event was emitted
      await assert.emits(erc20Bridged, tx, "Transfer", [
        hre.ethers.constants.AddressZero,
        recipient.address,
        mintAmount,
      ]);

      // validate balance was updated
      assert.equalBN(
        await erc20Bridged.balanceOf(recipient.address),
        mintAmount
      );

      // validate total supply was updated
      assert.equalBN(
        await erc20Bridged.totalSupply(),
        wei.toBigNumber(premint).add(mintAmount)
      );
    },
  ])

  .test("bridgeBurn() :: not owner", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, stranger } = ctx.accounts;

    await assert.revertsWith(
      erc20Bridged.connect(stranger).bridgeBurn(holder.address, wei`100 ether`),
      "ErrorNotBridge()"
    );
  })

  .test("bridgeBurn() :: amount exceeds balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { owner, stranger } = ctx.accounts;

    // validate stranger has no tokens
    assert.equalBN(await erc20Bridged.balanceOf(stranger.address), 0);

    await assert.revertsWith(
      erc20Bridged.connect(owner).bridgeBurn(stranger.address, wei`100 ether`),
      "ErrorNotEnoughBalance()"
    );
  })

  .group([wei`10 ether`, "0"], (burnAmount) => [
    `bridgeBurn() :: amount is ${burnAmount} wei`,
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { premint } = ctx.constants;
      const { owner, holder } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

      // validate total supply before mint
      assert.equalBN(await erc20Bridged.totalSupply(), premint);

      // burn tokens
      const tx = await erc20Bridged
        .connect(owner)
        .bridgeBurn(holder.address, burnAmount);

      // validate Transfer event was emitted
      await assert.emits(erc20Bridged, tx, "Transfer", [
        holder.address,
        hre.ethers.constants.AddressZero,
        burnAmount,
      ]);

      const expectedBalanceAndTotalSupply = wei
        .toBigNumber(premint)
        .sub(burnAmount);

      // validate balance was updated
      assert.equalBN(
        await erc20Bridged.balanceOf(holder.address),
        expectedBalanceAndTotalSupply
      );

      // validate total supply was updated
      assert.equalBN(
        await erc20Bridged.totalSupply(),
        expectedBalanceAndTotalSupply
      );
    },
  ])

  .run();

async function ctxFactory() {
  /// ---------------------------
  /// constants
  /// ---------------------------
  const name = "ERC20 Test Token";
  const symbol = "ERC20";
  const version = "1";
  const decimals = BigNumber.from(18);
  const premint = wei`100 ether`;

  const [deployer, owner, recipient, spender, holder, stranger] = await hre.ethers.getSigners();
  const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

  /// ---------------------------
  /// contracts
  /// ---------------------------
  const erc20BridgedProxied = await erc20BridgedPermitUnderProxy(
    deployer,
    holder,
    name,
    symbol,
    version,
    decimals,
    owner.address
  )

  /// ---------------------------
  /// setup
  /// ---------------------------
  await erc20BridgedProxied.connect(owner).bridgeMint(holder.address, premint);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [hre.ethers.constants.AddressZero],
  });

  return {
    accounts: { deployer, owner, recipient, spender, holder, zero, stranger },
    constants: { name, symbol, version, decimals, premint },
    erc20Bridged: erc20BridgedProxied,
  };
}
