import { assert } from "chai";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

scenario("Optimism :: Bridging integration test", ctxFactory)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate bridging on L1", async (ctx) => {
    const { l1ERC20TokenBridge } = ctx;
    const { l1ERC20TokenBridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l1ERC20TokenBridge.isDepositsEnabled();

    if (!isDepositsEnabled) {
      await l1ERC20TokenBridge
        .connect(l1ERC20TokenBridgeAdmin)
        .enableDeposits();
    } else {
      console.log("L1 deposits already enabled");
    }

    const isWithdrawalsEnabled =
      await l1ERC20TokenBridge.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l1ERC20TokenBridge
        .connect(l1ERC20TokenBridgeAdmin)
        .enableWithdrawals();
    } else {
      console.log("L1 withdrawals already enabled");
    }

    assert.isTrue(await l1ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenBridge.isWithdrawalsEnabled());
  })

  .step("Activate bridging on L2", async (ctx) => {
    const { l2ERC20TokenBridge } = ctx;
    const { l2ERC20TokenBridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l2ERC20TokenBridge.isDepositsEnabled();

    if (!isDepositsEnabled) {
      await l2ERC20TokenBridge
        .connect(l2ERC20TokenBridgeAdmin)
        .enableDeposits();
    } else {
      console.log("L2 deposits already enabled");
    }

    const isWithdrawalsEnabled =
      await l2ERC20TokenBridge.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l2ERC20TokenBridge
        .connect(l2ERC20TokenBridgeAdmin)
        .enableWithdrawals();
    } else {
      console.log("L2 withdrawals already enabled");
    }

    assert.isTrue(await l2ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenBridge.isWithdrawalsEnabled());
  })

  .step("L1 -> L2 deposit zero tokens via depositERC20() method", async (ctx) => {
    const {
      l1Token,
      l2Token,
      l1TokenRebasable,
      l1ERC20TokenBridge,
      l2TokenRebasable,
      l1CrossDomainMessenger,
      l2ERC20TokenBridge,
      tokensRateOracle,
      l1Provider
    } = ctx;

    const { accountA: tokenHolderA } = ctx.accounts;
    const tokensPerStEth = await l1Token.tokensPerStEth();
    
    await l1TokenRebasable
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, 0);

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
      tokenHolderA.address
    );

    const l1ERC20TokenBridgeBalanceBefore = await l1TokenRebasable.balanceOf(
      l1ERC20TokenBridge.address
    );

    for(var x = 0; x< 2; ++x) {
      const tx0 = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20(
        l1Token.address,
        l2Token.address,
        0,
        200_000,
        "0x"
      );

      const receipt0 = await tx0.wait();

      console.log("l1Token gasUsed=",receipt0.gasUsed);
    }

    for(var x = 0; x< 2; ++x) {

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20(
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        0,
        200_000,
        "0x"
      );

      const receipt1 = await tx.wait();

      console.log("l1TokenRebasable gasUsed=",receipt1.gasUsed);
      }
      //const gasDifference = receipt1.gasUsed.sub(receipt0.gasUsed);

      //console.log("gasUsed difference=", gasDifference);
      

    // const blockNumber = await l1Provider.getBlockNumber();
    // const blockTimestamp = (await l1Provider.getBlock(blockNumber)).timestamp;
    // const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 32)
    // const tokensPerStEthStr = ethers.utils.hexZeroPad(tokensPerStEth.toHexString(), 32)
    // const dataToSend = ethers.utils.hexConcat([tokensPerStEthStr, blockTimestampStr]);


    // await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
    //   l1TokenRebasable.address,
    //   l2TokenRebasable.address,
    //   tokenHolderA.address,
    //   tokenHolderA.address,
    //   0,
    //   dataToSend,
    // ]);

    // const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
    //   "finalizeDeposit",
    //   [
    //     l1TokenRebasable.address,
    //     l2TokenRebasable.address,
    //     tokenHolderA.address,
    //     tokenHolderA.address,
    //     0,
    //     dataToSend,
    //   ]
    // );

    // const messageNonce = await l1CrossDomainMessenger.messageNonce();

    // await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
    //   l2ERC20TokenBridge.address,
    //   l1ERC20TokenBridge.address,
    //   l2DepositCalldata,
    //   messageNonce,
    //   200_000,
    // ]);

    // assert.equalBN(
    //   await l1Token.balanceOf(l1ERC20TokenBridge.address),
    //   l1ERC20TokenBridgeBalanceBefore
    // );

    // assert.equalBN(
    //   await l1TokenRebasable.balanceOf(tokenHolderA.address),
    //   tokenHolderABalanceBefore
    // );
  })

  

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");
  console.log("networkName=",networkName);
  
  const {
    l1Provider,
    l2Provider,
    l1ERC20TokenBridgeAdmin,
    l2ERC20TokenBridgeAdmin,
    ...contracts
  } = await optimism.testing(networkName).getIntegrationTestSetup();

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  // await optimism.testing(networkName).stubL1CrossChainMessengerContract();

  const accountA = testing.accounts.accountA(l1Provider, l2Provider);
  const accountB = testing.accounts.accountB(l1Provider, l2Provider);

  const depositAmount = wei`0.15 ether`;
  const withdrawalAmount = wei`0.05 ether`;

  await testing.setBalance(
    await contracts.l1TokensHolder.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  await testing.setBalance(
    await l1ERC20TokenBridgeAdmin.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  await testing.setBalance(
    await l2ERC20TokenBridgeAdmin.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  await contracts.l1TokenRebasable
    .connect(contracts.l1TokensHolder)
    .transfer(accountA.l1Signer.address, wei.toBigNumber(depositAmount).mul(2));

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
    l2Provider
  );

  console.log("l1CrossDomainMessengerAliased=",l1CrossDomainMessengerAliased);
  console.log("contracts.l1CrossDomainMessenger.address=",contracts.l1CrossDomainMessenger.address);

  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  return {
    l1Provider,
    l2Provider,
    ...contracts,
    accounts: {
      accountA,
      accountB,
      l1Stranger: testing.accounts.stranger(l1Provider),
      l1ERC20TokenBridgeAdmin,
      l2ERC20TokenBridgeAdmin,
      l1CrossDomainMessengerAliased,
    },
    common: {
      depositAmount,
      withdrawalAmount,
    },
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}
