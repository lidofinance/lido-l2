import { ethers } from "hardhat";
import { assert } from "chai";
import { utils } from 'ethers'
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import {
    TokenRateNotifier__factory,
    ITokenRatePusher__factory,
    OpStackTokenRatePusher__factory,
    ITokenRateOracle__factory,
    ERC20BridgedStub__factory,
    ERC20WrapperStub__factory,
    CrossDomainMessengerStub__factory,
    OpStackTokenRatePusherWithSomeErrorStub__factory,
    OpStackTokenRatePusherWithOutOfGasErrorStub__factory
} from "../../typechain";

unit("TokenRateNotifier", ctxFactory)

  .test("initial state", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.MAX_OBSERVERS_COUNT(), 16);
    assert.equal(await tokenRateNotifier.INVALID_INTERFACE_ID(), "0xffffffff");
    const iTokenRateObserver = getInterfaceID(ITokenRatePusher__factory.createInterface());
    assert.equal(await tokenRateNotifier.REQUIRED_INTERFACE(), iTokenRateObserver._hex);
    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
  })

  .test("addObserver() :: not the owner", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { stranger } = ctx.accounts;

    await assert.revertsWith(
        tokenRateNotifier
            .connect(stranger)
            .addObserver(ethers.constants.AddressZero),
        "Ownable: caller is not the owner"
    );
  })

  .test("addObserver() :: revert on adding zero address observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;

    await assert.revertsWith(
      tokenRateNotifier.addObserver(ethers.constants.AddressZero),
      "ErrorZeroAddressObserver()"
    );
  })

  .test("addObserver() :: revert on adding observer with bad interface", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    const observer = await new TokenRateNotifier__factory(deployer).deploy();
    await assert.revertsWith(
      tokenRateNotifier.addObserver(observer.address),
      "ErrorBadObserverInterface()"
    );
  })

  .test("addObserver() :: revert on adding too many observers", async (ctx) => {
    const { tokenRateNotifier, opStackTokenRatePusher } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
    const maxObservers = await tokenRateNotifier.MAX_OBSERVERS_COUNT();
    for (let i = 0; i < maxObservers.toNumber(); i++) {
        await tokenRateNotifier.addObserver(opStackTokenRatePusher.address);
    }
    assert.equalBN(await tokenRateNotifier.observersLength(), maxObservers);

    await assert.revertsWith(
      tokenRateNotifier.addObserver(opStackTokenRatePusher.address),
      "ErrorMaxObserversCountExceeded()"
    );
  })

  .test("addObserver() :: happy path of adding observer", async (ctx) => {
    const { tokenRateNotifier, opStackTokenRatePusher } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
    const tx = await tokenRateNotifier.addObserver(opStackTokenRatePusher.address);
    assert.equalBN(await tokenRateNotifier.observersLength(), 1);

    await assert.emits(tokenRateNotifier, tx, "ObserverAdded", [opStackTokenRatePusher.address]);
  })

  .test("removeObserver() :: revert on calling by not the owner", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { stranger } = ctx.accounts;

    await assert.revertsWith(
        tokenRateNotifier
            .connect(stranger)
            .removeObserver(ethers.constants.AddressZero),
        "Ownable: caller is not the owner"
    );
  })

  .test("removeObserver() :: revert on removing non-added observer", async (ctx) => {
    const { tokenRateNotifier, opStackTokenRatePusher } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    await assert.revertsWith(
      tokenRateNotifier.removeObserver(opStackTokenRatePusher.address),
      "ErrorNoObserverToRemove()"
    );
  })

  .test("removeObserver() :: happy path of removing observer", async (ctx) => {
    const { tokenRateNotifier, opStackTokenRatePusher } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    await tokenRateNotifier.addObserver(opStackTokenRatePusher.address);

    assert.equalBN(await tokenRateNotifier.observersLength(), 1);

    const tx = await tokenRateNotifier.removeObserver(opStackTokenRatePusher.address);
    await assert.emits(tokenRateNotifier, tx, "ObserverRemoved", [opStackTokenRatePusher.address]);

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
  })

  .test("handlePostTokenRebase() :: failed with some error", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    const observer = await new OpStackTokenRatePusherWithSomeErrorStub__factory(deployer).deploy();
    await tokenRateNotifier.addObserver(observer.address);

    const tx = await tokenRateNotifier.handlePostTokenRebase(1,2,3,4,5,6,7);

    await assert.emits(tokenRateNotifier, tx, "PushTokenRateFailed", [observer.address, "0x332e27d2"]);
  })

  .test("handlePostTokenRebase() :: revert when observer has out of gas error", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    const observer = await new OpStackTokenRatePusherWithOutOfGasErrorStub__factory(deployer).deploy();
    await tokenRateNotifier.addObserver(observer.address);

    await assert.revertsWith(
      tokenRateNotifier.handlePostTokenRebase(1,2,3,4,5,6,7),
      "ErrorTokenRateNotifierRevertedWithNoData()"
    );
  })

  .test("handlePostTokenRebase() :: happy path of handling token rebase", async (ctx) => {
    const {
        tokenRateNotifier,
        l1MessengerStub,
        opStackTokenRatePusher,
        l1TokenNonRebasableStub
    } = ctx.contracts;
    const { tokenRateOracle } = ctx.accounts;
    const { l2GasLimitForPushingTokenRate } = ctx.constants;

    let tokenRate = await l1TokenNonRebasableStub.stEthPerToken();
    await tokenRateNotifier.addObserver(opStackTokenRatePusher.address);
    let tx = await tokenRateNotifier.handlePostTokenRebase(1,2,3,4,5,6,7);

    const provider = await ethers.provider;
    const blockNumber = await provider.getBlockNumber();
    const blockTimestamp = (await provider.getBlock(blockNumber)).timestamp;

    await assert.emits(l1MessengerStub, tx, "SentMessage", [
        tokenRateOracle.address,
        opStackTokenRatePusher.address,
        ITokenRateOracle__factory.createInterface().encodeFunctionData(
            "updateRate",
            [
                tokenRate,
                blockTimestamp
            ]
        ),
        1,
        l2GasLimitForPushingTokenRate,
      ]);
  })

  .run();

async function ctxFactory() {
    const [deployer, bridge, stranger, tokenRateOracle] = await ethers.getSigners();
    const tokenRateNotifier = await new TokenRateNotifier__factory(deployer).deploy();

    const l1TokenRebasableStub = await new ERC20BridgedStub__factory(deployer).deploy(
      "L1 Token Rebasable",
      "L1R"
    );

    const l1TokenNonRebasableStub = await new ERC20WrapperStub__factory(deployer).deploy(
      l1TokenRebasableStub.address,
      "L1 Token Non Rebasable",
      "L1NR"
    );

    const l1MessengerStub = await new CrossDomainMessengerStub__factory(
      deployer
    ).deploy({ value: wei.toBigNumber(wei`1 ether`) });

    const l2GasLimitForPushingTokenRate = 123;

    const opStackTokenRatePusher = await new OpStackTokenRatePusher__factory(deployer).deploy(
      l1MessengerStub.address,
      l1TokenNonRebasableStub.address,
      tokenRateOracle.address,
      l2GasLimitForPushingTokenRate
    );

    return {
      accounts: { deployer, bridge, stranger, tokenRateOracle },
      contracts: { tokenRateNotifier, opStackTokenRatePusher, l1MessengerStub, l1TokenNonRebasableStub },
      constants: { l2GasLimitForPushingTokenRate }
    };
}

export function getInterfaceID(contractInterface: utils.Interface) {
    let interfaceID = ethers.constants.Zero;
    const functions: string[] = Object.keys(contractInterface.functions);
    for (let i = 0; i < functions.length; i++) {
        interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
    }
    return interfaceID;
}
