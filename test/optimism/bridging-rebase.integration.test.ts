import { assert } from "chai";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { ERC20WrapperStub } from "../../typechain";

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

  .step("Set up Token Rate Oracle by pushing first rate", async (ctx) => {

    const {
        l1Token,
        l1TokenRebasable,
        l2TokenRebasable,
        l1ERC20TokenBridge,
        l2CrossDomainMessenger,
        l2ERC20TokenBridge,
        l2Provider
      } = ctx;

    const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
      ctx.accounts;
    const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

    const tx = await l2CrossDomainMessenger
    .connect(l1CrossDomainMessengerAliased)
    .relayMessage(
      1,
      l1ERC20TokenBridge.address,
      l2ERC20TokenBridge.address,
      0,
      300_000,
      l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        0,
        dataToReceive,
      ]),
      { gasLimit: 5_000_000 }
    );
  })

  .step("Push token rate to L2", async (ctx) => {
    const {
        l1Token,
        l1TokenRebasable,
        l1ERC20TokenBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20TokenBridge,
        l1Provider
      } = ctx;

    const { l1Stranger } = ctx.accounts;

    const tokenHolderStrangerBalanceBefore = await l1TokenRebasable.balanceOf(
      l1Stranger.address
    );

    const l1ERC20TokenBridgeBalanceBefore = await l1TokenRebasable.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(l1Stranger)
      .pushTokenRate(200_000);

      const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

      await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        l1Stranger.address,
        l2ERC20TokenBridge.address,
        0,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          l1Stranger.address,
          l2ERC20TokenBridge.address,
          0,
          dataToSend,
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
        l1ERC20TokenBridgeBalanceBefore
      );

      assert.equalBN(
        await l1TokenRebasable.balanceOf(l1Stranger.address),
        tokenHolderStrangerBalanceBefore
      );
  })

  .step("L1 -> L2 deposit zero tokens via depositERC20() method", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l1ERC20TokenBridge,
      l2TokenRebasable,
      l1CrossDomainMessenger,
      l2ERC20TokenBridge,
      l1Provider
    } = ctx;

    const { accountA: tokenHolderA } = ctx.accounts;

    await l1TokenRebasable
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, 0);

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
      tokenHolderA.address
    );

    const l1ERC20TokenBridgeBalanceBefore = await l1TokenRebasable.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20(
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        0,
        200_000,
        "0x"
      );

    const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      0,
      dataToSend,
    ]);

    const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
      "finalizeDeposit",
      [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        0,
        dataToSend,
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
      l1ERC20TokenBridgeBalanceBefore
    );

    assert.equalBN(
      await l1TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore
    );
  })

  .step("Finalize deposit zero tokens on L2", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l2TokenRebasable,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
      l2Provider
    } = ctx;

    const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

    const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
      ctx.accounts;

    const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(
      tokenHolderA.address
    );

    const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        1,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.address,
        0,
        300_000,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderA.address,
          0,
          dataToReceive,
        ]),
        { gasLimit: 5_000_000 }
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      0,
      "0x",
    ]);

    assert.equalBN(
      await l2TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore
    );
    assert.equalBN(
      await l2TokenRebasable.totalSupply(),
      l2TokenRebasableTotalSupplyBefore
    );
  })

  .step("L1 -> L2 deposit via depositERC20() method", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l1ERC20TokenBridge,
      l2TokenRebasable,
      l1CrossDomainMessenger,
      l2ERC20TokenBridge,
      l1Provider
    } = ctx;
    const { accountA: tokenHolderA } = ctx.accounts;
    const { depositAmountNonRebasable, depositAmountRebasable } = ctx.common;

    await l1TokenRebasable
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, depositAmountRebasable);

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
      tokenHolderA.address
    );

    const l1ERC20TokenBridgeBalanceBefore = await l1TokenRebasable.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20(
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        depositAmountRebasable,
        200_000,
        "0x"
      );

    const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      depositAmountRebasable,
      dataToSend,
    ]);

    const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
      "finalizeDeposit",
      [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmountNonRebasable,
        dataToSend,
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
      l1ERC20TokenBridgeBalanceBefore.add(depositAmountNonRebasable)
    );

    assert.equalBN(
      await l1TokenRebasable.balanceOf(tokenHolderA.address), // stETH
      tokenHolderABalanceBefore.sub(depositAmountRebasable)
    );
  })

  .step("Finalize deposit on L2", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l2TokenRebasable,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
      l2Provider
    } = ctx;
    const { depositAmountNonRebasable, depositAmountRebasable } = ctx.common;

    const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
      ctx.accounts;

    const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(
      tokenHolderA.address
    );

    const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();
    const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

    const tx = await l2CrossDomainMessenger
      .connect(l1CrossDomainMessengerAliased)
      .relayMessage(
        1,
        l1ERC20TokenBridge.address,
        l2ERC20TokenBridge.address,
        0,
        300_000,
        l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderA.address,
          depositAmountNonRebasable,
          dataToReceive,
        ]),
        { gasLimit: 5_000_000 }
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      depositAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l2TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(depositAmountRebasable)
    );
    assert.equalBN(
      await l2TokenRebasable.totalSupply(),
      l2TokenRebasableTotalSupplyBefore.add(depositAmountRebasable)
    );
  })

  .step("L2 -> L1 withdrawal via withdraw()", async (ctx) => {
    const { accountA: tokenHolderA } = ctx.accounts;
    const { withdrawalAmountRebasable } = ctx.common;
    const {
        l1TokenRebasable,
        l2TokenRebasable,
        l2ERC20TokenBridge
    } = ctx;

    const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(
      tokenHolderA.address
    );
    const l2TotalSupplyBefore = await l2TokenRebasable.totalSupply();

    const tx = await l2ERC20TokenBridge
      .connect(tokenHolderA.l2Signer)
      .withdraw(
        l2TokenRebasable.address,
        withdrawalAmountRebasable,
        0,
        "0x"
    );

    await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      withdrawalAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l2TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.sub(withdrawalAmountRebasable)
    );
    assert.equalBN(
      await l2TokenRebasable.totalSupply(),
      l2TotalSupplyBefore.sub(withdrawalAmountRebasable)
    );
 })

  .step("Finalize withdrawal on L1", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2TokenRebasable,
      l2ERC20TokenBridge,
    } = ctx;
    const { accountA: tokenHolderA, l1Stranger } = ctx.accounts;
    const { withdrawalAmountNonRebasable, withdrawalAmountRebasable } = ctx.common;

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
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
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderA.address,
            tokenHolderA.address,
            withdrawalAmountNonRebasable,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderA.address,
      withdrawalAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
    );

    assert.equalBN(
      await l1TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
    );
  })


  .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {

    const {
        l1Token,
        l1TokenRebasable,
        l1ERC20TokenBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20TokenBridge,
        l1Provider
      } = ctx;
    const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
    assert.notEqual(tokenHolderA.address, tokenHolderB.address);

    const { exchangeRate } = ctx.common;
    const depositAmountNonRebasable = wei`0.03 ether`;
    const depositAmountRebasable = wei.toBigNumber(depositAmountNonRebasable).mul(exchangeRate);

    await l1TokenRebasable
      .connect(tokenHolderA.l1Signer)
      .approve(l1ERC20TokenBridge.address, depositAmountRebasable);

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
      tokenHolderA.address
    );
    const l1ERC20TokenBridgeBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenBridge.address
    );

    const tx = await l1ERC20TokenBridge
      .connect(tokenHolderA.l1Signer)
      .depositERC20To(
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderB.address,
        depositAmountRebasable,
        200_000,
        "0x"
      );

      const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

      await assert.emits(l1ERC20TokenBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmountRebasable,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20TokenBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderB.address,
          depositAmountNonRebasable,
          dataToSend,
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
        l1ERC20TokenBridgeBalanceBefore.add(depositAmountNonRebasable)
      );

      assert.equalBN(
        await l1TokenRebasable.balanceOf(tokenHolderA.address), // stETH
        tokenHolderABalanceBefore.sub(depositAmountRebasable)
      );
  })

  .step("Finalize deposit on L2", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l1ERC20TokenBridge,
      l2TokenRebasable,
      l2CrossDomainMessenger,
      l2ERC20TokenBridge,
      l2Provider
    } = ctx;

    const {
      accountA: tokenHolderA,
      accountB: tokenHolderB,
      l1CrossDomainMessengerAliased,
    } = ctx.accounts;

    const { exchangeRate } = ctx.common;

    const depositAmountNonRebasable = wei`0.03 ether`;
    const depositAmountRebasable = wei.toBigNumber(depositAmountNonRebasable).mul(exchangeRate);

    const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

    const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();

    const tokenHolderBBalanceBefore = await l2TokenRebasable.balanceOf(
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
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderB.address,
          depositAmountNonRebasable,
          dataToReceive,
        ]),
        { gasLimit: 5_000_000 }
      );

    await assert.emits(l2ERC20TokenBridge, tx, "DepositFinalized", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderA.address,
      tokenHolderB.address,
      depositAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l2TokenRebasable.balanceOf(tokenHolderB.address),
      tokenHolderBBalanceBefore.add(depositAmountRebasable)
    );

    assert.equalBN(
      await l2TokenRebasable.totalSupply(),
      l2TokenRebasableTotalSupplyBefore.add(depositAmountRebasable)
    );
  })

  .step("L2 -> L1 withdrawal via withdrawTo()", async (ctx) => {
    const { l1TokenRebasable, l2TokenRebasable, l2ERC20TokenBridge } = ctx;
    const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;

    const { exchangeRate } = ctx.common;
    const withdrawalAmountNonRebasable = wei`0.03 ether`;
    const withdrawalAmountRebasable = wei.toBigNumber(withdrawalAmountNonRebasable).mul(exchangeRate);

    const tokenHolderBBalanceBefore = await l2TokenRebasable.balanceOf(
      tokenHolderB.address
    );
    const l2TotalSupplyBefore = await l2TokenRebasable.totalSupply();

    const tx = await l2ERC20TokenBridge
      .connect(tokenHolderB.l2Signer)
      .withdrawTo(
        l2TokenRebasable.address,
        tokenHolderA.address,
        withdrawalAmountRebasable,
        0,
        "0x"
      );

    await assert.emits(l2ERC20TokenBridge, tx, "WithdrawalInitiated", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderB.address,
      tokenHolderA.address,
      withdrawalAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l2TokenRebasable.balanceOf(tokenHolderB.address),
      tokenHolderBBalanceBefore.sub(withdrawalAmountRebasable)
    );

    assert.equalBN(
      await l2TokenRebasable.totalSupply(),
      l2TotalSupplyBefore.sub(withdrawalAmountRebasable)
    );
  })

  .step("Finalize withdrawal on L1", async (ctx) => {
    const {
      l1Token,
      l1TokenRebasable,
      l1CrossDomainMessenger,
      l1ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2TokenRebasable,
      l2ERC20TokenBridge,
    } = ctx;
    const {
      accountA: tokenHolderA,
      accountB: tokenHolderB,
      l1Stranger,
    } = ctx.accounts;

    const { exchangeRate } = ctx.common;
    const withdrawalAmountNonRebasable = wei`0.03 ether`;
    const withdrawalAmountRebasable = wei.toBigNumber(withdrawalAmountNonRebasable).mul(exchangeRate);

    const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(
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
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderB.address,
            tokenHolderA.address,
            withdrawalAmountNonRebasable,
            "0x",
          ]
        ),
        0
      );

    await assert.emits(l1ERC20TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1TokenRebasable.address,
      l2TokenRebasable.address,
      tokenHolderB.address,
      tokenHolderA.address,
      withdrawalAmountRebasable,
      "0x",
    ]);

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenBridge.address),
      l1ERC20TokenBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
    );

    assert.equalBN(
      await l1TokenRebasable.balanceOf(tokenHolderA.address),
      tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
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

  const exchangeRate = 2;
  const depositAmountNonRebasable = wei`0.15 ether`;
  const depositAmountRebasable = wei.toBigNumber(depositAmountNonRebasable).mul(exchangeRate);

  const withdrawalAmountNonRebasable = wei`0.05 ether`;
  const withdrawalAmountRebasable = wei.toBigNumber(withdrawalAmountNonRebasable).mul(exchangeRate);

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
    .transfer(accountA.l1Signer.address, depositAmountRebasable);

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
    l2Provider
  );

  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  await contracts.l1ERC20TokenBridge.connect(l1ERC20TokenBridgeAdmin).pushTokenRate(1000000);

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
      depositAmountNonRebasable,
      depositAmountRebasable,
      withdrawalAmountNonRebasable,
      withdrawalAmountRebasable,
      exchangeRate,
    },
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}

async function packedTokenRateAndTimestamp(l1Provider: JsonRpcProvider, l1Token: ERC20WrapperStub) {
    const stEthPerToken = await l1Token.stEthPerToken();
    const blockNumber = await l1Provider.getBlockNumber();
    const blockTimestamp = (await l1Provider.getBlock(blockNumber)).timestamp;
    const stEthPerTokenStr = ethers.utils.hexZeroPad(stEthPerToken.toHexString(), 12);
    const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);
    return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr]);
}
