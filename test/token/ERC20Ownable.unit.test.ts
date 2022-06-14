import { assert } from "chai";
import hre from "hardhat";
import {
  ERC20Ownable__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { testsuite } from "../../utils/testing";
import { wei } from "../../utils/wei";

testsuite("ERC20Ownable unit tests", ctxProvider, (ctx) => {
  it("admin()", async () => {
    assert.equal(await ctx.erc20Ownable.owner(), ctx.accounts.owner.address);
  });

  it("decimals()", async () => {
    assert.equal(await ctx.erc20Ownable.decimals(), ctx.constants.decimals);
  });

  it("name()", async () => {
    assert.equal(await ctx.erc20Ownable.name(), ctx.constants.name);
  });

  it("symbol()", async () => {
    assert.equal(await ctx.erc20Ownable.symbol(), ctx.constants.symbol);
  });

  it("totalSupply()", async () => {
    assert.equalBN(await ctx.erc20Ownable.totalSupply(), ctx.constants.premint);
  });

  it("approve()", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, spender },
    } = ctx;

    // validate initially allowance is zero
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      "0"
    );

    const amount = wei`1 ether`;

    // validate return value of the method
    assert.isTrue(await l2Token.callStatic.approve(spender.address, amount));

    // approve tokens
    const tx = await ctx.erc20Ownable.approve(spender.address, amount);

    // validate Approval event was emitted
    await assert.emits(ctx.erc20Ownable, tx, "Approval", [
      holder.address,
      spender.address,
      amount,
    ]);

    // validate allowance was set
    assert.equalBN(
      await ctx.erc20Ownable.allowance(holder.address, spender.address),
      amount
    );
  });

  it("transfer() :: sender is zero address", async () => {
    const {
      accounts: { zero, recipient },
    } = ctx;
    assert.revertsWith(
      ctx.erc20Ownable.connect(zero).transfer(recipient.address, wei`1 ether`),
      "ErrorZeroAddress()"
    );
  });

  it("transfer() :: recipient is zero address", async () => {
    const {
      accounts: { zero, holder },
    } = ctx;
    assert.revertsWith(
      ctx.erc20Ownable.connect(holder).transfer(zero.address, wei`1 ether`),
      "ErrorZeroAddress()"
    );
  });

  it("transfer() :: zero balance", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, holder },
    } = ctx;

    // validate balance before transfer
    assert.equalBN(await ctx.erc20Ownable.balanceOf(holder.address), premint);

    // transfer tokens
    await l2Token.connect(holder).transfer(recipient.address, "0");

    // validate balance stays same
    assert.equalBN(await ctx.erc20Ownable.balanceOf(holder.address), premint);
  });

  it("transfer() :: not enough balance", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, holder },
    } = ctx;

    // validate balance before transfer
    assert.equalBN(await l2Token.balanceOf(holder.address), premint);

    const amount = wei.toBigNumber(premint).add(wei`1 ether`);

    // transfer tokens
    assert.revertsWith(
      l2Token.connect(holder).transfer(recipient.address, amount),
      "ErrorNotEnoughBalance()"
    );
  });

  it("transfer()", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, holder },
    } = ctx;

    // validate balance before transfer
    assert.equalBN(await l2Token.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    const tx = await l2Token
      .connect(holder)
      .transfer(recipient.address, amount);

    // validate Transfer event was emitted
    await assert.emits(l2Token, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate balance was updated
    assert.equalBN(
      await l2Token.balanceOf(holder.address),
      wei.toBigNumber(premint).sub(amount)
    );

    // validate total supply stays same
    assert.equalBN(await l2Token.totalSupply(), premint);
  });

  it("transferFrom()", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, spender, holder },
    } = ctx;

    const initialAllowance = wei`2 ether`;

    // set allowance
    await l2Token.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await l2Token.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await l2Token.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await l2Token.balanceOf(holder.address);

    // transfer tokens
    const tx = await l2Token
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was emitted
    await assert.emits(l2Token, tx, "Approval", [
      holder.address,
      recipient.address,
      wei.toBigNumber(initialAllowance).sub(amount),
    ]);

    // validate Transfer event was emitted
    await assert.emits(l2Token, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance updated
    assert.equalBN(
      await l2Token.allowance(holder.address, recipient.address),
      wei.toBigNumber(initialAllowance).sub(amount)
    );

    // validate holder balance updated
    assert.equalBN(
      await l2Token.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await l2Token.balanceOf(recipient.address), amount);
  });

  it("transferFrom() :: max allowance", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, spender, holder },
    } = ctx;

    const initialAllowance = hre.ethers.constants.MaxUint256;

    // set allowance
    await l2Token.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await l2Token.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await l2Token.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await l2Token.balanceOf(holder.address);

    // transfer tokens
    const tx = await l2Token
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was not emitted
    await assert.notEmits(l2Token, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(l2Token, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await l2Token.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await l2Token.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await l2Token.balanceOf(recipient.address), amount);
  });

  it("transferFrom() :: not enough allowance", async () => {
    const {
      erc20Ownable: l2Token,
      constants: { premint },
      accounts: { recipient, spender, holder },
    } = ctx;

    const initialAllowance = wei`0.9 ether`;

    // set allowance
    await l2Token.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await l2Token.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await l2Token.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    await assert.revertsWith(
      l2Token
        .connect(spender)
        .transferFrom(holder.address, recipient.address, amount),
      "ErrorNotEnoughAllowance()"
    );
  });

  it("increaseAllowance() :: initial allowance is zero", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, spender },
    } = ctx;

    // validate allowance before increasing
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      "0"
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await l2Token.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    // validate Approval event was emitted
    await assert.emits(l2Token, tx, "Approval", [
      holder.address,
      spender.address,
      allowanceIncrease,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      allowanceIncrease
    );
  });

  it("increaseAllowance() :: initial allowance is not zero", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, spender },
    } = ctx;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await l2Token.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      initialAllowance
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await l2Token.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    const expectedAllowance = wei
      .toBigNumber(initialAllowance)
      .add(allowanceIncrease);

    // validate Approval event was emitted
    await assert.emits(l2Token, tx, "Approval", [
      holder.address,
      spender.address,
      expectedAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      expectedAllowance
    );
  });

  it("increaseAllowance() :: the increase is not zero", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, spender },
    } = ctx;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await l2Token.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      initialAllowance
    );

    // increase allowance
    const tx = await l2Token.increaseAllowance(spender.address, "0");

    // validate Approval event was emitted
    await assert.emits(l2Token, tx, "Approval", [
      holder.address,
      spender.address,
      initialAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      initialAllowance
    );
  });

  it("decreaseAllowance() :: decrease is greater than current allowance", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, spender },
    } = ctx;

    // validate allowance before increasing
    assert.equalBN(
      await l2Token.allowance(holder.address, spender.address),
      "0"
    );

    const allowanceDecrease = wei`1 ether`;

    // decrease allowance
    await assert.revertsWith(
      l2Token.decreaseAllowance(spender.address, allowanceDecrease),
      "ErrorDecreasedAllowanceBelowZero()"
    );
  });

  for (const allowanceDecrease of [wei`1 ether`, "0"]) {
    it(`decreaseAllowance() :: the decrease is ${allowanceDecrease} wei`, async () => {
      const {
        erc20Ownable: l2Token,
        accounts: { holder, spender },
      } = ctx;

      const initialAllowance = wei`2 ether`;

      // set initial allowance
      await l2Token.approve(spender.address, initialAllowance);

      // validate allowance before increasing
      assert.equalBN(
        await l2Token.allowance(holder.address, spender.address),
        initialAllowance
      );

      // decrease allowance
      const tx = await l2Token.decreaseAllowance(
        spender.address,
        allowanceDecrease
      );

      const expectedAllowance = wei
        .toBigNumber(initialAllowance)
        .sub(allowanceDecrease);

      // validate Approval event was emitted
      await assert.emits(l2Token, tx, "Approval", [
        holder.address,
        spender.address,
        expectedAllowance,
      ]);

      // validate allowance was updated correctly
      assert.equalBN(
        await l2Token.allowance(holder.address, spender.address),
        expectedAllowance
      );
    });
  }

  it("mint() :: not owner", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      l2Token.connect(stranger).mint(stranger.address, wei`1000 ether`),
      "ErrorNotOwner()"
    );
  });

  for (const mintAmount of [wei`1000 ether`, "0"]) {
    it(`mint() :: amount is ${mintAmount} wei`, async () => {
      const {
        erc20Ownable: l2Token,
        accounts: { owner, recipient },
        constants: { premint },
      } = ctx;

      // validate balance before mint
      assert.equalBN(await l2Token.balanceOf(recipient.address), 0);

      // validate total supply before mint
      assert.equalBN(await l2Token.totalSupply(), premint);

      // mint tokens
      const tx = await l2Token
        .connect(owner)
        .mint(recipient.address, mintAmount);

      // validate Transfer event was emitted
      await assert.emits(l2Token, tx, "Transfer", [
        hre.ethers.constants.AddressZero,
        recipient.address,
        mintAmount,
      ]);

      // validate balance was updated
      assert.equalBN(await l2Token.balanceOf(recipient.address), mintAmount);

      // validate total supply was updated
      assert.equalBN(
        await l2Token.totalSupply(),
        wei.toBigNumber(premint).add(mintAmount)
      );
    });
  }

  it("burn() :: not owner", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { holder, stranger },
    } = ctx;

    await assert.revertsWith(
      l2Token.connect(stranger).burn(holder.address, wei`100 ether`),
      "ErrorNotOwner()"
    );
  });

  it("burn() :: amount exceeds balance", async () => {
    const {
      erc20Ownable: l2Token,
      accounts: { stranger, owner },
    } = ctx;

    // validate stranger has no tokens
    assert.equalBN(await l2Token.balanceOf(stranger.address), 0);

    await assert.revertsWith(
      l2Token.connect(owner).burn(stranger.address, wei`100 ether`),
      "ErrorNotEnoughBalance()"
    );
  });

  for (const burnAmount of [wei`10 ether`, "0"]) {
    it(`burn() :: amount is ${burnAmount} wei`, async () => {
      const {
        erc20Ownable: l2Token,
        accounts: { owner, holder },
        constants: { premint },
      } = ctx;

      // validate balance before mint
      assert.equalBN(await l2Token.balanceOf(holder.address), premint);

      // validate total supply before mint
      assert.equalBN(await l2Token.totalSupply(), premint);

      // burn tokens
      const tx = await l2Token.connect(owner).burn(holder.address, burnAmount);

      // validate Transfer event was emitted
      await assert.emits(l2Token, tx, "Transfer", [
        holder.address,
        hre.ethers.constants.AddressZero,
        burnAmount,
      ]);

      const expectedBalanceAndTotalSupply = wei
        .toBigNumber(premint)
        .sub(burnAmount);

      // validate balance was updated
      assert.equalBN(
        await l2Token.balanceOf(holder.address),
        expectedBalanceAndTotalSupply
      );

      // validate total supply was updated
      assert.equalBN(
        await l2Token.totalSupply(),
        expectedBalanceAndTotalSupply
      );
    });
  }
});

async function ctxProvider() {
  const name = "ERC20 Test Token";
  const symbol = "ERC20";
  const decimals = 18;
  const premint = wei`100 ether`;
  const [deployer, owner, recipient, spender, holder, stranger] =
    await hre.ethers.getSigners();
  const l2TokenImpl = await new ERC20Ownable__factory(deployer).deploy(
    name,
    symbol,
    decimals,
    owner.address
  );

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [hre.ethers.constants.AddressZero],
  });

  const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

  const l2TokensProxy = await new OssifiableProxy__factory(deployer).deploy(
    l2TokenImpl.address,
    deployer.address,
    ERC20Ownable__factory.createInterface().encodeFunctionData("initialize", [
      name,
      symbol,
    ])
  );

  const erc20OwnableProxied = ERC20Ownable__factory.connect(
    l2TokensProxy.address,
    holder
  );

  await erc20OwnableProxied.connect(owner).mint(holder.address, premint);

  return {
    accounts: { deployer, owner, recipient, spender, holder, zero, stranger },
    constants: { name, symbol, decimals, premint },
    erc20Ownable: erc20OwnableProxied,
  };
}
