import { assert } from "chai";
import hre from "hardhat";
import {
  ERC20BridgedPermit__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { getPermitSignature } from "../../utils/testing/permit";
import { constants } from 'ethers'

unit("ERC20BridgedPermit", ctxFactory)
  .test("bridge()", async (ctx) => {
    assert.equal(await ctx.erc20BridgedPermit.bridge(), ctx.accounts.owner.address);
  })

  .test("totalSupply()", async (ctx) => {
    assert.equalBN(await ctx.erc20BridgedPermit.totalSupply(), ctx.constants.premint);
  })

  .test("initialize() :: name already set", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const erc20BridgedPermitImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
      "Name",
      "",
      9,
      owner.address
    );
    await assert.revertsWith(
      erc20BridgedPermitImpl.initialize("New Name", ""),
      "ErrorNameAlreadySet()"
    );
  })

  .test("permit() :: valid signature", async (ctx) => {
    const { erc20BridgedPermit } = ctx;
    const { holder, spender } = ctx.accounts;
    const value = 123

    const { v, r, s } = await getPermitSignature(holder, erc20BridgedPermit, spender.address, value)

    assert.equalBN(await erc20BridgedPermit.allowance(holder.address, spender.address), 0)
    await erc20BridgedPermit.permit(
      holder.address,
      spender.address,
      value,
      constants.MaxUint256,
      v,
      r,
      s
    )

    assert.equalBN(await erc20BridgedPermit.allowance(holder.address, spender.address), value)
  })

  .test("useNonce() :: can invalidate valid signature", async (ctx) => {
    const { erc20BridgedPermit } = ctx;
    const { holder, spender } = ctx.accounts;
    const value = 123

    const { v, r, s } = await getPermitSignature(holder, erc20BridgedPermit, spender.address, value)

    assert.equalBN(await erc20BridgedPermit.allowance(holder.address, spender.address), 0)

    await erc20BridgedPermit.useNonce()

    await assert.revertsWith(
      erc20BridgedPermit.permit(
        holder.address,
        spender.address,
        value,
        constants.MaxUint256,
        v,
        r,
        s
      ),
      "ErrorInvalidSignature()"
    );

    assert.equalBN(await erc20BridgedPermit.allowance(holder.address, spender.address), 0)
  })

  .run();

  async function ctxFactory() {
    const name = "ERC20 Test Token";
    const symbol = "ERC20";
    const decimals = 18;
    const premint = wei`100 ether`;
    const [deployer, owner, recipient, spender, holder, stranger] =
      await hre.ethers.getSigners();
    const l2TokenImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
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
      ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
      ])
    );

    const erc20BridgedPermitProxied = ERC20BridgedPermit__factory.connect(
      l2TokensProxy.address,
      holder
    );
    ERC20BridgedPermit__factory
    await erc20BridgedPermitProxied.connect(owner).bridgeMint(holder.address, premint);

    return {
      accounts: { deployer, owner, recipient, spender, holder, zero, stranger },
      constants: { name, symbol, decimals, premint },
      erc20BridgedPermit: erc20BridgedPermitProxied,
    };
  }