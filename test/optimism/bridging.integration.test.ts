import { assert } from "chai";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";

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

  .step("L1 -> L2 deposit via depositERC20() method", async (ctx) => {
    const {
      l1Token,
      l1ERC20TokenBridge,
      l2Token,
      l1CrossDomainMessenger,
      l2ERC20TokenBridge,
    } = ctx;
    const { accountA: tokenHolderA } = ctx.accounts;
    const { depositAmount } = ctx.common;

    await l1Token
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, depositAmount);

    const tokenHolderABalanceBefore = await l1Token.balanceOf(
      tokenHolderA.address
    );
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20(
        l1Token.address,
        l2Token.address,
        depositAmount,
        200_000,
        "0x"
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderA.address,
      depositAmount,
      "0x",
    ]);

    const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
      "finalizeDeposit",
      [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmount,
        "0x",
      ]
    );

    const messageNonce = await l1CrossDomainMessenger.messageNonce();

    await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
      l2ERC20TokenBridge.address,
      l1ERC20TokenBridge.address,
      l2DepositCalldata,
      messageNonce,
      200_000,
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.add(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.sub(depositAmount)
    );
  })

  .step("Finalize deposit on L2", async (ctx) => {
    const {
      l1Token,
      l2Token,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
    } = ctx;
    const { depositAmount } = ctx.common;
    const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
      ctx.accounts;

    const tokenHolderABalanceBefore = await l2Token.balanceOf(
      tokenHolderA.address
    );
    const l2TokenTotalSupplyBefore = await l2Token.totalSupply();

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        1,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.address,
        0,
        300_000,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1Token.address,
          l2Token.address,
          tokenHolderA.address,
          tokenHolderA.address,
          depositAmount,
          "0x",
        ]),
        { gasLimit: 5_000_000 }
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderA.address,
      depositAmount,
      "0x",
    ]);
    assert.equalBN(
      await l2Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(depositAmount)
    );
    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenTotalSupplyBefore.add(depositAmount)
    );
  })

  .step("L2 -> L1 withdrawal via withdraw()", async (ctx) => {
    const { accountA: tokenHolderA } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;
    const { l1Token, l2Token, l2ERC20TokenBridge } = ctx;

    const tokenHolderABalanceBefore = await l2Token.balanceOf(
      tokenHolderA.address
    );
    const l2TotalSupplyBefore = await l2Token.totalSupply();

    const tx = await l2ERC20TokenBridge
      .connect(tokenHolderA.l2Signer)
      .withdraw(l2Token.address, withdrawalAmount, 0, "0x");

    await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderA.address,
      withdrawalAmount,
      "0x",
    ]);
    assert.equalBN(
      await l2Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.sub(withdrawalAmount)
    );
    assert.equalBN(
      await l2Token.totalSupply(),
      l2TotalSupplyBefore.sub(withdrawalAmount)
    );
  })

  .step("Finalize withdrawal on L1", async (ctx) => {
    const {
      l1Token,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2Token,
      l2ERC20TokenBridge,
    } = ctx;
    const { accountA: tokenHolderA, l1Stranger } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const tokenHolderABalanceBefore = await l1Token.balanceOf(
      tokenHolderA.address
    );
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    await l1CrossDomainMessenger
      .connect(l1Stranger)
      .setXDomainMessageSender(l2ERC20TokenBridge.address);

    const tx = await l1CrossDomainMessenger
      .connect(l1Stranger)
      .relayMessage(
        l1ERC20TokenBridge.address,
        l2CrossDomainMessenger.address,
        l1ERC20TokenBridge.interface.encodeFunctionData(
          "finalizeERC20Withdrawal",
          [
            l1Token.address,
            l2Token.address,
            tokenHolderA.address,
            tokenHolderA.address,
            withdrawalAmount,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderA.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(withdrawalAmount)
    );
  })

  .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {
    const {
      l1Token,
      l2Token,
      l1ERC20TokenBridge,
      l2ERC20TokenBridge,
      l1CrossDomainMessenger,
    } = ctx;
    const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
    const { depositAmount } = ctx.common;

    assert.notEqual(tokenHolderA.address, tokenHolderB.address);

    await l1Token
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, depositAmount);

    const tokenHolderABalanceBefore = await l1Token.balanceOf(
      tokenHolderA.address
    );
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20To(
        l1Token.address,
        l2Token.address,
        tokenHolderB.address,
        depositAmount,
        200_000,
        "0x"
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderB.address,
      depositAmount,
      "0x",
    ]);

    const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
      "finalizeDeposit",
      [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmount,
        "0x",
      ]
    );

    const messageNonce = await l1CrossDomainMessenger.messageNonce();

    await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
      l2ERC20TokenBridge.address,
      l1ERC20TokenBridge.address,
      l2DepositCalldata,
      messageNonce,
      200_000,
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.add(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.sub(depositAmount)
    );
  })

  .step("Finalize deposit on L2", async (ctx) => {
    const {
      l1Token,
      l1ERC20TokenBridge,
      l2Token,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
    } = ctx;
    const {
      accountA: tokenHolderA,
      accountB: tokenHolderB,
      l1CrossDomainMessengerAliased,
    } = ctx.accounts;
    const { depositAmount } = ctx.common;

    const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
    const tokenHolderBBalanceBefore = await l2Token.balanceOf(
      tokenHolderB.address
    );

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        1,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.address,
        0,
        300_000,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1Token.address,
          l2Token.address,
          tokenHolderA.address,
          tokenHolderB.address,
          depositAmount,
          "0x",
        ]),
        { gasLimit: 5_000_000 }
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1Token.address,
      l2Token.address,
      tokenHolderA.address,
      tokenHolderB.address,
      depositAmount,
      "0x",
    ]);

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenTotalSupplyBefore.add(depositAmount)
    );
    assert.equalBN(
      await l2Token.balanceOf(tokenHolderB.address),
      tokenHolderBBalanceBefore.add(depositAmount)
    );
  })

  .step("L2 -> L1 withdrawal via withdrawTo()", async (ctx) => {
    const { l1Token, l2Token, l2ERC20TokenBridge } = ctx;
    const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const tokenHolderBBalanceBefore = await l2Token.balanceOf(
      tokenHolderB.address
    );
    const l2TotalSupplyBefore = await l2Token.totalSupply();

    const tx = await l2ERC20TokenBridge
      .connect(tokenHolderB.l2Signer)
      .withdrawTo(
        l2Token.address,
        tokenHolderA.address,
        withdrawalAmount,
        0,
        "0x"
      );

    await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
      l1Token.address,
      l2Token.address,
      tokenHolderB.address,
      tokenHolderA.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l2Token.balanceOf(tokenHolderB.address),
      tokenHolderBBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TotalSupplyBefore.sub(withdrawalAmount)
    );
  })

  .step("Finalize withdrawal on L1", async (ctx) => {
    const {
      l1Token,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2Token,
      l2ERC20TokenBridge,
    } = ctx;
    const {
      accountA: tokenHolderA,
      accountB: tokenHolderB,
      l1Stranger,
    } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const tokenHolderABalanceBefore = await l1Token.balanceOf(
      tokenHolderA.address
    );
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    await l1CrossDomainMessenger
      .connect(l1Stranger)
      .setXDomainMessageSender(l2ERC20TokenBridge.address);

    const tx = await l1CrossDomainMessenger
      .connect(l1Stranger)
      .relayMessage(
        l1ERC20TokenBridge.address,
        l2CrossDomainMessenger.address,
        l1ERC20TokenBridge.interface.encodeFunctionData(
          "finalizeERC20Withdrawal",
          [
            l1Token.address,
            l2Token.address,
            tokenHolderB.address,
            tokenHolderA.address,
            withdrawalAmount,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1Token.address,
      l2Token.address,
      tokenHolderB.address,
      tokenHolderA.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(withdrawalAmount)
    );
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");

  const {
    l1Provider,
    l2Provider,
    l1ERC20TokenBridgeAdmin,
    l2ERC20TokenBridgeAdmin,
    ...contracts
  } = await optimism.testing(networkName).getIntegrationTestSetup();

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  await optimism.testing(networkName).stubL1CrossChainMessengerContract();

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

  await contracts.l1Token
    .connect(contracts.l1TokensHolder)
    .transfer(accountA.l1Signer.address, wei.toBigNumber(depositAmount).mul(2));

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
    l2Provider
  );

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
