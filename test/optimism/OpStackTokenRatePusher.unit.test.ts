import hre, { ethers } from "hardhat";
import { assert } from "chai";
import { BigNumber } from 'ethers'
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { getInterfaceID, getExchangeRate } from "../../utils/testing/helpers";
import {
  OpStackTokenRatePusher__factory,
  CrossDomainMessengerStub__factory,
  ITokenRateOracle__factory,
  ITokenRatePusher__factory,
  ERC20BridgedStub__factory,
  ERC20WrapperStub__factory,
  AccountingOracleStub__factory

} from "../../typechain";

unit("OpStackTokenRatePusher", ctxFactory)

  .test("constructor() :: zero params", async (ctx) => {

    const { deployer, stranger, zero } = ctx.accounts;

    const accountingOracle = await new AccountingOracleStub__factory(deployer).deploy(1,2,3);

    await assert.revertsWith(new OpStackTokenRatePusher__factory(
      deployer
    ).deploy(
      zero.address,
      stranger.address,
      accountingOracle.address,
      stranger.address,
      10
    ), "ErrorZeroAddressMessenger()");

    await assert.revertsWith(new OpStackTokenRatePusher__factory(
      deployer
    ).deploy(
      stranger.address,
      zero.address,
      accountingOracle.address,
      stranger.address,
      10
    ), "ErrorZeroAddressWstETH()");

    await assert.revertsWith(new OpStackTokenRatePusher__factory(
      deployer
    ).deploy(
      stranger.address,
      stranger.address,
      zero.address,
      stranger.address,
      10
    ), "ErrorZeroAddressAccountingOracle()");

    await assert.revertsWith(new OpStackTokenRatePusher__factory(
      deployer
    ).deploy(
      stranger.address,
      stranger.address,
      accountingOracle.address,
      zero.address,
      10
    ), "ErrorZeroAddressTokenRateOracle()");
  })

  .test("initial state", async (ctx) => {
    const { tokenRateOracle } = ctx.accounts;
    const { opStackTokenRatePusher, l1MessengerStub, accountingOracle } = ctx.contracts;
    const { genesisTime, secondsPerSlot } = ctx.constants;

    assert.equal(await opStackTokenRatePusher.MESSENGER(), l1MessengerStub.address);
    assert.equalBN(await opStackTokenRatePusher.GENESIS_TIME(), genesisTime);
    assert.equalBN(await opStackTokenRatePusher.SECONDS_PER_SLOT(), secondsPerSlot);
    assert.equal(await opStackTokenRatePusher.ACCOUNTING_ORACLE(), accountingOracle.address);
    assert.equal(await opStackTokenRatePusher.L2_TOKEN_RATE_ORACLE(), tokenRateOracle.address);
    assert.equalBN(await opStackTokenRatePusher.L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE(), 123);
    const iTokenRatePusher = getInterfaceID(ITokenRatePusher__factory.createInterface());
    assert.isTrue(await opStackTokenRatePusher.supportsInterface(iTokenRatePusher._hex));
  })

  .test("pushTokenRate() :: success", async (ctx) => {
    const { tokenRateOracle } = ctx.accounts;
    const { l2GasLimitForPushingTokenRate, tokenRate, updateRateTime } = ctx.constants;
    const { opStackTokenRatePusher, l1MessengerStub } = ctx.contracts;

    let tx = await opStackTokenRatePusher.pushTokenRate();

    await assert.emits(l1MessengerStub, tx, "SentMessage", [
      tokenRateOracle.address,
      opStackTokenRatePusher.address,
      ITokenRateOracle__factory.createInterface().encodeFunctionData(
        "updateRate",
        [
          tokenRate,
          updateRateTime
        ]
      ),
      1,
      l2GasLimitForPushingTokenRate,
    ]);
  })

  .run();

async function ctxFactory() {
  /// ---------------------------
  /// constants
  /// ---------------------------
  const [deployer, bridge, stranger, tokenRateOracle, l1TokenBridgeEOA] = await ethers.getSigners();
  const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

  const totalPooledEther = BigNumber.from('9309904612343950493629678');
  const totalShares = BigNumber.from('7975822843597609202337218');
  const tokenRateDecimals = BigNumber.from(27);
  const tokenRate = getExchangeRate(tokenRateDecimals, totalPooledEther, totalShares);

  const genesisTime = BigNumber.from(1);
  const secondsPerSlot = BigNumber.from(2);
  const lastProcessingRefSlot = BigNumber.from(3);
  const updateRateTime = genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));
  const l2GasLimitForPushingTokenRate = 123;

  const l1MessengerStub = await new CrossDomainMessengerStub__factory(deployer)
    .deploy({ value: wei.toBigNumber(wei`1 ether`) });
  await l1MessengerStub.setXDomainMessageSender(l1TokenBridgeEOA.address);

  /// ---------------------------
  /// contracts
  /// ---------------------------
  const l1TokenRebasableStub = await new ERC20BridgedStub__factory(deployer).deploy(
    "L1 Token Rebasable",
    "L1R"
  );

  const l1TokenNonRebasableStub = await new ERC20WrapperStub__factory(deployer).deploy(
    l1TokenRebasableStub.address,
    "L1 Token Non Rebasable",
    "L1NR",
    totalPooledEther,
    totalShares
  );

  const accountingOracle = await new AccountingOracleStub__factory(deployer).deploy(
    genesisTime,
    secondsPerSlot,
    lastProcessingRefSlot
  );

  const opStackTokenRatePusher = await new OpStackTokenRatePusher__factory(deployer).deploy(
    l1MessengerStub.address,
    l1TokenNonRebasableStub.address,
    accountingOracle.address,
    tokenRateOracle.address,
    l2GasLimitForPushingTokenRate
  );

  return {
    accounts: { deployer, bridge, stranger, zero, tokenRateOracle },
    contracts: { opStackTokenRatePusher, l1MessengerStub, l1TokenNonRebasableStub, accountingOracle },
    constants: { l2GasLimitForPushingTokenRate, tokenRate, updateRateTime, genesisTime, secondsPerSlot, lastProcessingRefSlot }
  };
}
