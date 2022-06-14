import hre from "hardhat";
import { assert } from "chai";
import { testsuite } from "../../utils/testing";
import { ERC20Metadata__factory } from "../../typechain";

testsuite("ERC20Metadata unit tests", ctxProvider, (ctx) => {
  it("decimals()", async () => {
    assert.equal(await ctx.erc20Metadata.decimals(), ctx.constants.decimals);
  });

  it("name()", async () => {
    assert.equal(await ctx.erc20Metadata.name(), ctx.constants.name);
  });

  it("symbol()", async () => {
    assert.equal(await ctx.erc20Metadata.symbol(), ctx.constants.symbol);
  });
});

async function ctxProvider() {
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
