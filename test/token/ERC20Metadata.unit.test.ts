import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { ERC20Metadata__factory } from "../../typechain";

unit("ERC20Metadata", ctxFactory)
  .test("decimals()", async (ctx) =>
    assert.equal(await ctx.erc20Metadata.decimals(), ctx.constants.decimals)
  )

  .test("name()", async (ctx) =>
    assert.equal(await ctx.erc20Metadata.name(), ctx.constants.name)
  )

  .test("symbol()", async (ctx) =>
    assert.equal(await ctx.erc20Metadata.symbol(), ctx.constants.symbol)
  )

  .run();

async function ctxFactory() {
  const decimals = 18;
  const symbol = "ERC20";
  const name = "ERC20 Test Token";

  const [deployer] = await hre.ethers.getSigners();

  return {
    accounts: { deployer },
    erc20Metadata: await new ERC20Metadata__factory(deployer).deploy(
      name,
      symbol,
      decimals
    ),
    constants: { decimals, symbol, name },
  };
}
