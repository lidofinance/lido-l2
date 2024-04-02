import hre from "hardhat";
import { assert } from "chai";
import { unit, UnitTest } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { makeDomainSeparator, signPermit } from "../../utils/testing/permit-helpers";

import {
    ERC20Bridged__factory,
    TokenRateOracle__factory,
    OssifiableProxy__factory,
    ERC20RebasablePermit__factory,
    ERC1271PermitSignerMock__factory,
} from "../../typechain";
import { BigNumber } from "ethers";


type ContextType = Awaited<ReturnType<ReturnType<typeof ctxFactoryFactory>>>

const TOKEN_NAME = 'Liquid staked Ether 2.0'
const SIGNING_DOMAIN_VERSION = '2'

// derived from mnemonic: want believe mosquito cat design route voice cause gold benefit gospel bulk often attitude rural
const ACCOUNTS_AND_KEYS = [
  {
    address: '0xF4C028683CAd61ff284d265bC0F77EDd67B4e65A',
    privateKey: '0x5f7edf5892efb4a5cd75dedd496598f48e579b562a70eb1360474cc83a982987',
  },
  {
    address: '0x7F94c1F9e4BfFccc8Cd79195554E0d83a0a5c5f2',
    privateKey: '0x3fe2f6bd9dbc7d507a6cb95ec36a36787706617e34385292b66c74cd39874605',
  },
]

function getChainId() {
  return hre.network.config.chainId as number;
}

const getAccountsEOA = async () => {
  return {
    alice: ACCOUNTS_AND_KEYS[0],
    bob: ACCOUNTS_AND_KEYS[1],
  }
}

const getAccountsEIP1271 = async () => {
  const deployer = (await hre.ethers.getSigners())[0]
  const alice = await new ERC1271PermitSignerMock__factory(deployer).deploy()
  const bob = await new ERC1271PermitSignerMock__factory(deployer).deploy()
  return { alice, bob }
}

function permitTestsSuit(unitInstance: UnitTest<ContextType>)
{
  unitInstance

  .test("wrappedToken() :: has the same address is in constructor", async (ctx) => {
      const { rebasableProxied, wrappedToken } = ctx.contracts;
      assert.equal(await rebasableProxied.WRAPPED_TOKEN(), wrappedToken.address)
  })

  .test('eip712Domain() is correct', async (ctx) => {
    const token = ctx.contracts.rebasableProxied
    const [ , name, version, chainId, verifyingContract, ,  ] = await token.eip712Domain()

    assert.equal(name, TOKEN_NAME)
    assert.equal(version, SIGNING_DOMAIN_VERSION)
    assert.isDefined(hre.network.config.chainId)
    assert.equal(chainId.toNumber(), getChainId())
    assert.equal(verifyingContract, token.address)

    const domainSeparator = makeDomainSeparator(TOKEN_NAME, SIGNING_DOMAIN_VERSION, chainId, token.address)
    assert.equal(makeDomainSeparator(name, version, chainId, verifyingContract), domainSeparator)
  })

  .test('DOMAIN_SEPARATOR() is correct', async (ctx) => {
    const token = ctx.contracts.rebasableProxied

    const domainSeparator = makeDomainSeparator(TOKEN_NAME, SIGNING_DOMAIN_VERSION, getChainId(), token.address)
    assert.equal(await ctx.contracts.rebasableProxied.DOMAIN_SEPARATOR(), domainSeparator)
  })

  .test('grants allowance when a valid permit is given', async (ctx) => {
    const token = ctx.contracts.rebasableProxied

    const { owner, spender, deadline } = ctx.permitParams
    let { value } = ctx.permitParams
    // create a signed permit to grant Bob permission to spend Alice's funds
    // on behalf, and sign with Alice's key
    let nonce = 0
    const charlie = ctx.accounts.user2
    const charlieSigner = hre.ethers.provider.getSigner(charlie.address)

    const domainSeparator = makeDomainSeparator(TOKEN_NAME, SIGNING_DOMAIN_VERSION, getChainId(), token.address)
    let { v, r, s } = await signPermit(owner, spender.address, value, deadline, nonce, domainSeparator)

    // check that the allowance is initially zero
    assert.equalBN(await token.allowance(owner.address, spender.address), BigNumber.from(0))
    // check that the next nonce expected is zero
    assert.equalBN(await token.nonces(owner.address), BigNumber.from(0))
    // check domain separator
    assert.equal(await token.DOMAIN_SEPARATOR(), domainSeparator)

    // a third-party, Charlie (not Alice) submits the permit
    // TODO: handle unpredictable gas limit somehow better than setting it to a random constant
    const tx = await token.connect(charlieSigner)
      .permit(owner.address, spender.address, value, deadline, v, r, s, { gasLimit: '0xffffff' })

    // check that allowance is updated
    assert.equalBN(await token.allowance(owner.address, spender.address), BigNumber.from(value))
    await assert.emits(token, tx, 'Approval', [ owner.address, spender.address, value ])
    assert.equalBN(await token.nonces(owner.address), BigNumber.from(1))


    // increment nonce
    nonce = 1
    value = 4e5
    ;({ v, r, s } = await signPermit(owner, spender.address, value, deadline, nonce, domainSeparator))

    // submit the permit
    const tx2 = await token.connect(charlieSigner).permit(owner.address, spender.address, value, deadline, v, r, s)

    // check that allowance is updated
    assert.equalBN(await token.allowance(owner.address, spender.address), BigNumber.from(value))
    assert.emits(token, tx2, 'Approval', [ owner.address, spender.address, BigNumber.from(value) ] )
    assert.equalBN(await token.nonces(owner.address), BigNumber.from(2))
  })

  .run();
}

function ctxFactoryFactory(signingAccountsFuncFactory: typeof getAccountsEIP1271 | typeof getAccountsEOA) {
  return async () => {
    const name = TOKEN_NAME;
    const symbol = "StETH";
    const decimalsToSet = 18;
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
        user2,
    ] = await hre.ethers.getSigners();

    const wrappedToken = await new ERC20Bridged__factory(deployer).deploy(
        "WsETH Test Token",
        "WsETH",
        decimalsToSet,
        owner.address
    );
    const tokenRateOracle = await new TokenRateOracle__factory(deployer).deploy(
        hre.ethers.constants.AddressZero,
        owner.address,
        hre.ethers.constants.AddressZero,
        86400
    );
    const rebasableTokenImpl = await new ERC20RebasablePermit__factory(deployer).deploy(
      name,
      symbol,
      decimalsToSet,
      wrappedToken.address,
      tokenRateOracle.address,
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
      ERC20RebasablePermit__factory.createInterface().encodeFunctionData("initialize", [
        name,
        symbol,
      ])
    );

    const rebasableProxied = ERC20RebasablePermit__factory.connect(
      l2TokensProxy.address,
      holder
    );

    await tokenRateOracle.connect(owner).updateRate(rate, 1000);
    await rebasableProxied.connect(owner).mintShares(holder.address, premintShares);
    const { alice, bob } = await signingAccountsFuncFactory();

    const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    return {
      accounts: { deployer, owner, recipient, spender, holder, stranger, zero, user1, user2 },
      constants: { name, symbol, decimalsToSet, decimals, premintShares, premintTokens, rate },
      contracts: { rebasableProxied, wrappedToken, tokenRateOracle },
      permitParams: {
        owner: alice,
        spender: bob,
        value: 6e6,
        nonce: 0,
        deadline: MAX_UINT256,
      }
    };
  }
}

permitTestsSuit(unit("ERC20Permit with EIP1271 (contract) signing", ctxFactoryFactory(getAccountsEIP1271)));
permitTestsSuit(unit("ERC20Permit with ECDSA (EOA) signing", ctxFactoryFactory(getAccountsEOA)));
