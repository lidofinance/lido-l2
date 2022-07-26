import hre, { ethers } from "hardhat";
import testing, { scenario } from "../../utils/testing";
import optimism from "../../utils/optimism";
import { wei } from "../../utils/wei";
import { assert } from "chai";
import { BridgingManagement } from "../../utils/bridging-management";
import env from "../../utils/env";

scenario("Optimism :: Bridging integration test", ctxFactory)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate bridging", async (ctx) => {
    const { l1ERC20TokenBridge, l2ERC20TokenBridge } = ctx;
    const { l1ERC20TokenBridgeAdmin, l2ERC20TokenBridgeAdmin } = ctx.accounts;

    const l1BridgingManagement = new BridgingManagement(
      l1ERC20TokenBridge.address,
      l1ERC20TokenBridgeAdmin
    );

    const [l1AdminAddress, l2AdminAddress] = await Promise.all([
      l1ERC20TokenBridgeAdmin.getAddress(),
      l2ERC20TokenBridgeAdmin.getAddress(),
    ]);

    await l1BridgingManagement.setup({
      bridgeAdmin: l1AdminAddress,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [l1AdminAddress],
      withdrawalsEnablers: [l1AdminAddress],
    });

    const l2BridgingManagement = new BridgingManagement(
      l2ERC20TokenBridge.address,
      l2ERC20TokenBridgeAdmin
    );

    await l2BridgingManagement.setup({
      bridgeAdmin: l2AdminAddress,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [l2AdminAddress],
      withdrawalsEnablers: [l2AdminAddress],
    });

    assert.isTrue(await l1ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenBridge.isWithdrawalsEnabled());
    assert.isTrue(await l2ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenBridge.isWithdrawalsEnabled());
  })

  .step("Sender deposits tokens to himself via depositERC20()", async (ctx) => {
    const { l1Token, l1ERC20TokenBridge, l2Token } = ctx;
    const { l1Sender } = ctx.accounts;
    const { depositAmount } = ctx.common;

    await l1Token
      .connect(l1Sender)
      .approve(l1ERC20TokenBridge.address, depositAmount);

    const senderBalanceBefore = await l1Token.balanceOf(l1Sender.address);
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(l1Sender)
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
      l1Sender.address,
      l1Sender.address,
      depositAmount,
      "0x",
    ]);

    // TODO: Check event TransactionEnqueued emitted by the CanonicalTransactionChain

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.add(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1Sender.address),
      senderBalanceBefore.sub(depositAmount)
    );
  })

  .step("Finalize deposit via finalizeDeposit() on L2", async (ctx) => {
    const {
      l1Token,
      l2Token,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
    } = ctx;
    const { l2Sender, l1CrossDomainMessengerAliased } = ctx.accounts;
    const { depositAmount } = ctx.common;

    const senderBalanceBefore = await l2Token.balanceOf(l2Sender.address);
    const l2TokenTotalSupplyBefore = await l2Token.totalSupply();

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        l2ERC20TokenBridge.address,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1Token.address,
          l2Token.address,
          l2Sender.address,
          l2Sender.address,
          depositAmount,
          "0x",
        ]),
        1
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1Token.address,
      l2Token.address,
      l2Sender.address,
      l2Sender.address,
      depositAmount,
      "0x",
    ]);

    assert.equalBN(
      await l2Token.totalSupply(),
      senderBalanceBefore.add(depositAmount)
    );
    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenTotalSupplyBefore.add(depositAmount)
    );
  })

  .step("Sender withdraws tokens to himself via withdraw()", async (ctx) => {
    const { l1Token, l2Token, l2ERC20TokenBridge } = ctx;
    const { l2Sender } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const senderBalanceBefore = await l2Token.balanceOf(l2Sender.address);
    const l2TotalSupplyBefore = await l2Token.totalSupply();

    const tx = await l2ERC20TokenBridge
      .connect(l2Sender)
      .withdraw(l2Token.address, withdrawalAmount, 0, "0x");

    await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
      l1Token.address,
      l2Token.address,
      l2Sender.address,
      l2Sender.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l2Token.balanceOf(l2Sender.address),
      senderBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TotalSupplyBefore.sub(withdrawalAmount)
    );
  })

  .step("Finalize withdrawal via finalizeERC20Withdrawal()", async (ctx) => {
    const {
      l1Token,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2Token,
      l2ERC20TokenBridge,
    } = ctx;
    const { l1Sender } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const senderBalanceBefore = await l1Token.balanceOf(l1Sender.address);
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    await l1CrossDomainMessenger
      .connect(l1Sender)
      .setXDomainMessageSender(l2ERC20TokenBridge.address);

    const tx = await l1CrossDomainMessenger
      .connect(l1Sender)
      .relayMessage(
        l1ERC20TokenBridge.address,
        l2CrossDomainMessenger.address,
        l1ERC20TokenBridge.interface.encodeFunctionData(
          "finalizeERC20Withdrawal",
          [
            l1Token.address,
            l2Token.address,
            l1Sender.address,
            l1Sender.address,
            withdrawalAmount,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1Token.address,
      l2Token.address,
      l1Sender.address,
      l1Sender.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1Sender.address),
      senderBalanceBefore.add(withdrawalAmount)
    );
  })

  .step(
    "Sender deposits tokens to recipient via depositERC20To()",
    async (ctx) => {
      const { l1Token, l2Token, l1ERC20TokenBridge } = ctx;
      const { l1Sender, l1Recipient } = ctx.accounts;
      const { depositAmount } = ctx.common;

      await l1Token
        .connect(l1Sender)
        .approve(l1ERC20TokenBridge.address, depositAmount);

      const senderBalanceBefore = await l1Token.balanceOf(l1Sender.address);
      const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
        l1ERC20TokenBridge.address
      );

      const tx = await l1ERC20TokenBridge
        .connect(l1Sender)
        .depositERC20To(
          l1Token.address,
          l2Token.address,
          l1Recipient.address,
          depositAmount,
          200_000,
          "0x"
        );

      await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
        l1Token.address,
        l2Token.address,
        l1Sender.address,
        l1Recipient.address,
        depositAmount,
        "0x",
      ]);

      // TODO: Check event TransactionEnqueued emitted by the CanonicalTransactionChain

      assert.equalBN(
        await l1Token.balanceOf(l1ERC20TokenBridge.address),
        l1ERC20TokenBridgeBalanceBefore.add(depositAmount)
      );

      assert.equalBN(
        await l1Token.balanceOf(l1Sender.address),
        senderBalanceBefore.sub(depositAmount)
      );
    }
  )
  .step("Finalize deposit via finalizeDeposit()", async (ctx) => {
    const {
      l1Token,
      l1ERC20TokenBridge,
      l2Token,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
    } = ctx;
    const { l2Sender, l1Recipient, l1CrossDomainMessengerAliased } =
      ctx.accounts;
    const { depositAmount } = ctx.common;

    const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
    const recipientBalanceBefore = await l2Token.balanceOf(l1Recipient.address);

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        l2ERC20TokenBridge.address,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1Token.address,
          l2Token.address,
          l2Sender.address,
          l1Recipient.address,
          depositAmount,
          "0x",
        ]),
        1
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1Token.address,
      l2Token.address,
      l2Sender.address,
      l1Recipient.address,
      depositAmount,
      "0x",
    ]);

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenTotalSupplyBefore.add(depositAmount)
    );
    assert.equalBN(
      await l2Token.balanceOf(l1Recipient.address),
      recipientBalanceBefore.add(depositAmount)
    );
  })

  .step(
    "Recipient withdraws tokens to sender via withdrawTo()",
    async (ctx) => {
      const { l1Token, l2Token, l2ERC20TokenBridge } = ctx;
      const { l2Sender, l2Recipient } = ctx.accounts;
      const { withdrawalAmount } = ctx.common;

      const recipientBalanceBefore = await l2Token.balanceOf(
        l2Recipient.address
      );
      const l2TotalSupplyBefore = await l2Token.totalSupply();

      const tx = await l2ERC20TokenBridge
        .connect(l2Recipient)
        .withdrawTo(
          l2Token.address,
          l2Sender.address,
          withdrawalAmount,
          0,
          "0x"
        );

      await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
        l1Token.address,
        l2Token.address,
        l2Recipient.address,
        l2Sender.address,
        withdrawalAmount,
        "0x",
      ]);

      assert.equalBN(
        await l2Token.balanceOf(l2Recipient.address),
        recipientBalanceBefore.sub(withdrawalAmount)
      );

      assert.equalBN(
        await l2Token.totalSupply(),
        l2TotalSupplyBefore.sub(withdrawalAmount)
      );
    }
  )

  .step("Finalize withdrawal via finalizeERC20Withdrawal()", async (ctx) => {
    const {
      l1Token,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2Token,
      l2ERC20TokenBridge,
    } = ctx;
    const { l1Sender, l2Recipient } = ctx.accounts;
    const { withdrawalAmount } = ctx.common;

    const senderBalanceBefore = await l1Token.balanceOf(l1Sender.address);
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    await l1CrossDomainMessenger
      .connect(l1Sender)
      .setXDomainMessageSender(l2ERC20TokenBridge.address);

    const tx = await l1CrossDomainMessenger
      .connect(l1Sender)
      .relayMessage(
        l1ERC20TokenBridge.address,
        l2CrossDomainMessenger.address,
        l1ERC20TokenBridge.interface.encodeFunctionData(
          "finalizeERC20Withdrawal",
          [
            l1Token.address,
            l2Token.address,
            l2Recipient.address,
            l1Sender.address,
            withdrawalAmount,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1Token.address,
      l2Token.address,
      l2Recipient.address,
      l1Sender.address,
      withdrawalAmount,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1Sender.address),
      senderBalanceBefore.add(withdrawalAmount)
    );
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("NETWORK", "mainnet");

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

  const l1Sender = testing.accounts.sender(l1Provider);
  const l2Sender = testing.accounts.sender(l2Provider);
  const l1Recipient = testing.accounts.recipient(l1Provider);
  const l2Recipient = testing.accounts.recipient(l2Provider);

  const depositAmount = wei`0.15 ether`;
  const withdrawalAmount = wei`0.05 ether`;

  await l1Sender.sendTransaction({
    to: await contracts.l1TokensHolder.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await l1Sender.sendTransaction({
    to: await l1ERC20TokenBridgeAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await l2Sender.sendTransaction({
    to: await l2ERC20TokenBridgeAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await contracts.l1Token
    .connect(contracts.l1TokensHolder)
    .transfer(l1Sender.address, depositAmount);

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
    l2Provider
  );

  await l2Sender.sendTransaction({
    to: await l1CrossDomainMessengerAliased.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  return {
    l1Provider,
    l2Provider,
    ...contracts,
    accounts: {
      l1Sender,
      l2Sender,
      l1Recipient,
      l2Recipient,
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

function applyL1ToL2Alias(address: string) {
  const offset = "0x1111000000000000000000000000000000001111";
  const mask = ethers.BigNumber.from(2).pow(160);
  return hre.ethers.utils.getAddress(
    hre.ethers.BigNumber.from(address).add(offset).mod(mask).toHexString()
  );
}
