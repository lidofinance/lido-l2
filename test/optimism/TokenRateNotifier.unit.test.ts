import hre from "hardhat";
import { assert } from "chai";
import { unit } from "../../utils/testing";
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'

import {
    TokenRateNotifier__factory,
    ObserversArray__factory,
    OpStackTokenRateObserver__factory,
    ITokenRateObserver__factory,
} from "../../typechain";

unit("TokenRateNotifier", ctxFactory)

  .test("init with wrong interface", async (ctx) => {
    const { deployer } = ctx.accounts;
    await assert.revertsWith(new ObserversArray__factory(deployer).deploy(BigNumber.from("0xffffffff")._hex), "ErrorInvalidInterface()");
  })

  .test("initial state", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;

    assert.equalBN(await tokenRateNotifier.MAX_OBSERVERS_COUNT(), 16);
    assert.equal(await tokenRateNotifier.INVALID_INTERFACE_ID(), "0xffffffff");
    const iTokenRateObserver = getInterfaceID(ITokenRateObserver__factory.createInterface());
    assert.equal(await tokenRateNotifier.REQUIRED_INTERFACE(), iTokenRateObserver._hex);
    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
  })

  .test("add zero address observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    await assert.revertsWith(tokenRateNotifier.addObserver(hre.ethers.constants.AddressZero), "ErrorZeroAddressObserver()");
  })

  .test("add bad interface observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    const observer = await new TokenRateNotifier__factory(deployer).deploy();
    await assert.revertsWith(tokenRateNotifier.addObserver(observer.address), "ErrorBadObserverInterface()");
  })

  .test("add too many observers", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    const maxObservers = await tokenRateNotifier.MAX_OBSERVERS_COUNT();
    for (let i = 0; i < maxObservers.toNumber(); i++) {
        const observer = await new OpStackTokenRateObserver__factory(deployer).deploy(hre.ethers.constants.AddressZero, 10);
        await tokenRateNotifier.addObserver(observer.address);
    }

    assert.equalBN(await tokenRateNotifier.observersLength(), maxObservers);

    const observer = await new OpStackTokenRateObserver__factory(deployer).deploy(hre.ethers.constants.AddressZero, 10);
    await assert.revertsWith(tokenRateNotifier.addObserver(observer.address), "ErrorMaxObserversCountExceeded()");
  })

  .test("add observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    const observer = await new OpStackTokenRateObserver__factory(deployer).deploy(hre.ethers.constants.AddressZero, 10);
    const tx = await tokenRateNotifier.addObserver(observer.address);

    assert.equalBN(await tokenRateNotifier.observersLength(), 1);

    await assert.emits(tokenRateNotifier, tx, "ObserverAdded", [observer.address]);
  })

  .test("remove non-added observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    const observer = await new OpStackTokenRateObserver__factory(deployer).deploy(hre.ethers.constants.AddressZero, 10);
    await assert.revertsWith(tokenRateNotifier.removeObserver(observer.address), "ErrorNoObserverToRemove()");
  })

  .test("remove observer", async (ctx) => {
    const { tokenRateNotifier } = ctx.contracts;
    const { deployer } = ctx.accounts;

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);

    const observer = await new OpStackTokenRateObserver__factory(deployer).deploy(hre.ethers.constants.AddressZero, 10);
    await tokenRateNotifier.addObserver(observer.address);

    assert.equalBN(await tokenRateNotifier.observersLength(), 1);

    const tx = await tokenRateNotifier.removeObserver(observer.address);
    await assert.emits(tokenRateNotifier, tx, "ObserverRemoved", [observer.address]);

    assert.equalBN(await tokenRateNotifier.observersLength(), 0);
  })

  .run();

async function ctxFactory() {

    const [deployer, bridge, stranger] = await hre.ethers.getSigners();

    const tokenRateNotifier = await new TokenRateNotifier__factory(deployer).deploy();

    return {
      accounts: { deployer, bridge, stranger },
      contracts: { tokenRateNotifier }
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


