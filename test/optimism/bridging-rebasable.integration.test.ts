import { assert } from "chai";
import { BigNumber } from 'ethers'
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ScenarioTest } from "../../utils/testing";
import {
  tokenRateAndTimestampPacked,
  refSlotTimestamp,
  nonRebasableFromRebasableL1,
  nonRebasableFromRebasableL2,
  rebasableFromNonRebasableL1,
  rebasableFromNonRebasableL2
} from "../../utils/testing/helpers";

type ContextType = Awaited<ReturnType<ReturnType<typeof ctxFactory>>>

function bridgingTestsSuit(scenarioInstance: ScenarioTest<ContextType>) {
  scenarioInstance
    .after(async (ctx) => {
      await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
      await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
    })

    .step("Activate bridging on L1", async (ctx) => {
      const { l1LidoTokensBridge } = ctx;
      const { l1ERC20ExtendedTokensBridgeAdmin } = ctx.accounts;

      const isDepositsEnabled = await l1LidoTokensBridge.isDepositsEnabled();

      if (!isDepositsEnabled) {
        await l1LidoTokensBridge
          .connect(l1ERC20ExtendedTokensBridgeAdmin)
          .enableDeposits();
      } else {
        console.log("L1 deposits already enabled");
      }

      const isWithdrawalsEnabled =
        await l1LidoTokensBridge.isWithdrawalsEnabled();

      if (!isWithdrawalsEnabled) {
        await l1LidoTokensBridge
          .connect(l1ERC20ExtendedTokensBridgeAdmin)
          .enableWithdrawals();
      } else {
        console.log("L1 withdrawals already enabled");
      }

      assert.isTrue(await l1LidoTokensBridge.isDepositsEnabled());
      assert.isTrue(await l1LidoTokensBridge.isWithdrawalsEnabled());
    })

    .step("Activate bridging on L2", async (ctx) => {
      const { l2ERC20ExtendedTokensBridge } = ctx;
      const { l2ERC20ExtendedTokensBridgeAdmin } = ctx.accounts;

      const isDepositsEnabled = await l2ERC20ExtendedTokensBridge.isDepositsEnabled();

      if (!isDepositsEnabled) {
        await l2ERC20ExtendedTokensBridge
          .connect(l2ERC20ExtendedTokensBridgeAdmin)
          .enableDeposits();
      } else {
        console.log("L2 deposits already enabled");
      }

      const isWithdrawalsEnabled =
        await l2ERC20ExtendedTokensBridge.isWithdrawalsEnabled();

      if (!isWithdrawalsEnabled) {
        await l2ERC20ExtendedTokensBridge
          .connect(l2ERC20ExtendedTokensBridgeAdmin)
          .enableWithdrawals();
      } else {
        console.log("L2 withdrawals already enabled");
      }

      assert.isTrue(await l2ERC20ExtendedTokensBridge.isDepositsEnabled());
      assert.isTrue(await l2ERC20ExtendedTokensBridge.isWithdrawalsEnabled());
    })

    .step("L1 -> L2 deposit via depositERC20() method", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l2TokenRebasable,
        l1LidoTokensBridge,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        accountingOracle
      } = ctx;
      const { accountA: tokenHolderA } = ctx.accounts;
      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      /// wrap L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(
        depositAmountOfRebasableToken,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );

      console.log("depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap L1: depositAmountNonRebasable=",depositAmountNonRebasable);

      await l1TokenRebasable
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmountOfRebasableToken);

      const rebasableTokenHolderBalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceBefore = await l1TokenRebasable.balanceOf(l1Token.address);

      ctx.balances.accountABalanceBeforeDeposit = rebasableTokenHolderBalanceBefore;

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20(
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          depositAmountOfRebasableToken,
          200_000,
          "0x"
        );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmountOfRebasableToken,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
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
        l2ERC20ExtendedTokensBridge.address,
        l1LidoTokensBridge.address,
        l2DepositCalldata,
        messageNonce,
        200_000,
      ]);

      const rebasableTokenHolderBalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const wrappedRebasableTokenBalanceAfter = await l1TokenRebasable.balanceOf(l1Token.address);

      assert.equalBN(
        rebasableTokenHolderBalanceAfter,
        rebasableTokenHolderBalanceBefore.sub(depositAmountOfRebasableToken)
      );

      // during wrapping 1-2 wei can be lost
      assert.isTrue(almostEqual(
          depositAmountNonRebasable,
          nonRebasableTokenBridgeBalanceAfter.sub(nonRebasableTokenBridgeBalanceBefore))
      );

      assert.equalBN(
        wrappedRebasableTokenBalanceAfter,
        warappedRebasableTokenBalanceBefore.add(depositAmountOfRebasableToken)
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1TokenRebasable,
        accountingOracle,
        l2TokenRebasable,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge
      } = ctx;

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      // first wrap on L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(
        depositAmountOfRebasableToken,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );
      // second wrap on L2
      const depositAmountRebasable = rebasableFromNonRebasableL2(
        depositAmountNonRebasable,
        ctx.constants.tokenRateDecimals,
        ctx.constants.tokenRate
      );

      console.log("input:      depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap on L1: depositAmountNonRebasable=",depositAmountNonRebasable);
      console.log("wrap on L2: depositAmountRebasable=",depositAmountRebasable);

      const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } = ctx.accounts;

      const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToReceive = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      const tx = await l2CrossDomainMessenger
        .connect(l1CrossDomainMessengerAliased)
        .relayMessage(
          1,
          l1LidoTokensBridge.address,
          l2ERC20ExtendedTokensBridge.address,
          0,
          300_000,
          l2ERC20ExtendedTokensBridge.interface.encodeFunctionData("finalizeDeposit", [
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderA.address,
            tokenHolderA.address,
            depositAmountNonRebasable,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmountRebasable,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TokenRebasableTotalSupplyAfter = await l2TokenRebasable.totalSupply();

      console.log("rebasable on L2 tokenHolderABalanceBefore=",tokenHolderABalanceBefore);
      console.log("rebasable on L2 tokenHolderABalanceAfter=",tokenHolderABalanceAfter);
      console.log("diff on L2      tokenHolderABalance=",tokenHolderABalanceBefore.add(depositAmountRebasable).sub(tokenHolderABalanceAfter));

      assert.equalBN(
        tokenHolderABalanceBefore.add(depositAmountRebasable),
        tokenHolderABalanceAfter
      );
      assert.equalBN(
        l2TokenRebasableTotalSupplyBefore.add(depositAmountRebasable),
        l2TokenRebasableTotalSupplyAfter
      );
    })

    .step("L2 -> L1 withdrawal via withdraw()", async (ctx) => {
      const { accountA: tokenHolderA } = ctx.accounts;
      const {
        l1TokenRebasable,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge
      } = ctx;
      const { withdrawalAmountOfRebasableToken } = ctx.constants;

      const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TotalSupplyBefore = await l2TokenRebasable.totalSupply();

      console.log("input: withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderA.l2Signer)
        .withdraw(
          l2TokenRebasable.address,
          withdrawalAmountOfRebasableToken,
          0,
          "0x"
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmountOfRebasableToken,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TotalSupplyAfter = await l2TokenRebasable.totalSupply()

      // during unwrapping 1-2 wei can be lost
      assert.isTrue(almostEqual(tokenHolderABalanceAfter, tokenHolderABalanceBefore.sub(withdrawalAmountOfRebasableToken)));
      assert.isTrue(almostEqual(l2TotalSupplyAfter, l2TotalSupplyBefore.sub(withdrawalAmountOfRebasableToken)));
    })

    .step("Finalize withdrawal on L1", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l1CrossDomainMessenger,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge,
      } = ctx;
      const { accountA: tokenHolderA, l1Stranger } = ctx.accounts;
      const { depositAmountOfRebasableToken, withdrawalAmountOfRebasableToken, tokenRate } = ctx.constants;

      // unwrap on L2
      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(
        withdrawalAmountOfRebasableToken,
        ctx.constants.tokenRateDecimals,
        tokenRate);

      // unwrap on L1: loosing 1-2 wei
      const withdrawalAmountRebasable = rebasableFromNonRebasableL1(
        withdrawalAmountNonRebasable,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );

      console.log("input:        withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);
      console.log("unwrap on L2: withdrawalAmountNonRebasable=",withdrawalAmountNonRebasable);
      console.log("unwrap on L1: withdrawalAmountRebasable=",withdrawalAmountRebasable);

      const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const l1LidoTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      await l1CrossDomainMessenger
        .connect(l1Stranger)
        .setXDomainMessageSender(l2ERC20ExtendedTokensBridge.address);

      const tx = await l1CrossDomainMessenger
        .connect(l1Stranger)
        .relayMessage(
          l1LidoTokensBridge.address,
          l2CrossDomainMessenger.address,
          l1LidoTokensBridge.interface.encodeFunctionData(
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

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmountRebasable,
        "0x",
      ]);

      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const tokenHolderABalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);

      console.log("rebasable on L1 tokenHolderABalanceBefore=",tokenHolderABalanceBefore);
      console.log("rebasable on L1 tokenHolderABalanceAfter=",tokenHolderABalanceAfter);
      console.log("diff on L1 tokenHolderA=",tokenHolderABalanceAfter.sub(tokenHolderABalanceBefore.add(withdrawalAmountRebasable)));

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawal = depositAmountOfRebasableToken.sub(withdrawalAmountOfRebasableToken);
      assert.isTrue(almostEqual(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawal))
      );
    })

    .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {

      const {
        l1Token,
        l1TokenRebasable,
        accountingOracle,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
      } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
      assert.notEqual(tokenHolderA.address, tokenHolderB.address);

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      // wrap on L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(
        depositAmountOfRebasableToken,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );

      const rebasableTokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceBefore = await l1TokenRebasable.balanceOf(l1Token.address);

      // save to check balance later
      ctx.balances.accountABalanceBeforeDeposit = rebasableTokenHolderABalanceBefore;
      ctx.balances.accountBBalanceBeforeDeposit = await l2TokenRebasable.balanceOf(tokenHolderB.address);

      await l1TokenRebasable
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmountOfRebasableToken);

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20To(
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderB.address,
          depositAmountOfRebasableToken,
          200_000,
          "0x"
        );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmountOfRebasableToken,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
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
        l2ERC20ExtendedTokensBridge.address,
        l1LidoTokensBridge.address,
        l2DepositCalldata,
        messageNonce,
        200_000,
      ]);

      const rebasableTokenHolderABalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceAfter = await l1TokenRebasable.balanceOf(l1Token.address);

      assert.equalBN(
        rebasableTokenHolderABalanceAfter,
        rebasableTokenHolderABalanceBefore.sub(depositAmountOfRebasableToken)
      );

      // during wrapping 1-2 wei can be lost
      assert.isTrue(almostEqual(
        depositAmountNonRebasable,
        nonRebasableTokenBridgeBalanceAfter.sub(nonRebasableTokenBridgeBalanceBefore))
      );

      assert.equalBN(
        warappedRebasableTokenBalanceAfter,
        warappedRebasableTokenBalanceBefore.add(depositAmountOfRebasableToken)
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1TokenRebasable,
        accountingOracle,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge
      } = ctx;

      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1CrossDomainMessengerAliased,
      } = ctx.accounts;

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      // wrap on L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(
        depositAmountOfRebasableToken,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );
      // wrap on L2: loosing 1-2 wei for big numbers
      const depositAmountRebasable = rebasableFromNonRebasableL2(
        depositAmountNonRebasable,
        ctx.constants.tokenRateDecimals,
        ctx.constants.tokenRate
      );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToReceive = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();
      const tokenHolderBBalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderB.address);

      const tx = await l2CrossDomainMessenger
        .connect(l1CrossDomainMessengerAliased)
        .relayMessage(
          1,
          l1LidoTokensBridge.address,
          l2ERC20ExtendedTokensBridge.address,
          0,
          300_000,
          l2ERC20ExtendedTokensBridge.interface.encodeFunctionData("finalizeDeposit", [
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderA.address,
            tokenHolderB.address,
            depositAmountNonRebasable,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
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
      const { l1TokenRebasable, l2TokenRebasable, l2ERC20ExtendedTokensBridge } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;

      const { withdrawalAmountOfRebasableToken } = ctx.constants;

      const tokenHolderBBalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderB.address);
      const l2TotalSupplyBefore = await l2TokenRebasable.totalSupply();

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderB.l2Signer)
        .withdrawTo(
          l2TokenRebasable.address,
          tokenHolderA.address,
          withdrawalAmountOfRebasableToken,
          0,
          "0x"
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderB.address,
        tokenHolderA.address,
        withdrawalAmountOfRebasableToken,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2TokenRebasable.balanceOf(tokenHolderB.address);
      const l2TotalSupplyAfter = await l2TokenRebasable.totalSupply()

      assert.isTrue(almostEqual(tokenHolderABalanceAfter, tokenHolderBBalanceBefore.sub(withdrawalAmountOfRebasableToken)));
      assert.isTrue(almostEqual(l2TotalSupplyAfter, l2TotalSupplyBefore.sub(withdrawalAmountOfRebasableToken)));
    })

    .step("Finalize withdrawal on L1", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l1CrossDomainMessenger,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge,
      } = ctx;
      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1Stranger,
      } = ctx.accounts;

      const { depositAmountOfRebasableToken, withdrawalAmountOfRebasableToken, tokenRate } = ctx.constants;

      // unwrap on L2
      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(
        withdrawalAmountOfRebasableToken,
        ctx.constants.tokenRateDecimals,
        tokenRate);

      // unwrap on L1: loosing 1-2 wei
      const withdrawalAmountRebasable = rebasableFromNonRebasableL1(
        withdrawalAmountNonRebasable,
        ctx.constants.totalPooledEther,
        ctx.constants.totalShares
      );

      const tokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const l1LidoTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      await l1CrossDomainMessenger
        .connect(l1Stranger)
        .setXDomainMessageSender(l2ERC20ExtendedTokensBridge.address);

      const tx = await l1CrossDomainMessenger
        .connect(l1Stranger)
        .relayMessage(
          l1LidoTokensBridge.address,
          l2CrossDomainMessenger.address,
          l1LidoTokensBridge.interface.encodeFunctionData(
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

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderB.address,
        tokenHolderA.address,
        withdrawalAmountRebasable,
        "0x",
      ]);

      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const tokenHolderABalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const tokenHolderBBalanceAfter = await l2TokenRebasable.balanceOf(tokenHolderB.address);

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawal = depositAmountOfRebasableToken.sub(withdrawalAmountOfRebasableToken);
      assert.isTrue(almostEqual(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawal))
      );
      assert.isTrue(almostEqual(
        ctx.balances.accountBBalanceBeforeDeposit,
        tokenHolderBBalanceAfter.sub(deltaDepositWithdrawal))
      );
    })

    .run();
}

function ctxFactory(
  totalPooledEther: BigNumber,
  totalShares: BigNumber,
  tokenRateDecimals: BigNumber,
  depositAmountOfRebasableToken: BigNumber,
  withdrawalAmountOfRebasableToken: BigNumber
) {
  return async () => {
    const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");

    const {
      l1Provider,
      l2Provider,
      l1ERC20ExtendedTokensBridgeAdmin,
      l2ERC20ExtendedTokensBridgeAdmin,
      ...contracts
    } = await optimism.testing(networkName).getIntegrationTestSetup(totalPooledEther, totalShares);

    const l1Snapshot = await l1Provider.send("evm_snapshot", []);
    const l2Snapshot = await l2Provider.send("evm_snapshot", []);

    const exchangeRate = await contracts.l1Token.getStETHByWstETH(BigNumber.from(10).pow(tokenRateDecimals));

    await optimism.testing(networkName).stubL1CrossChainMessengerContract();

    const accountA = testing.accounts.accountA(l1Provider, l2Provider);
    const accountB = testing.accounts.accountB(l1Provider, l2Provider);

    await testing.setBalance(
      await contracts.l1TokensHolder.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l1Provider
    );

    await testing.setBalance(
      await l1ERC20ExtendedTokensBridgeAdmin.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l1Provider
    );

    await testing.setBalance(
      await l2ERC20ExtendedTokensBridgeAdmin.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l2Provider
    );

    const l1CrossDomainMessengerAliased = await testing.impersonate(
      testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
      l2Provider
    );

    await testing.setBalance(
      await l1CrossDomainMessengerAliased.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l2Provider
    );

    await contracts.l1TokenRebasable
      .connect(contracts.l1TokensHolder)
      .transfer(accountA.l1Signer.address, depositAmountOfRebasableToken.mul(2));

    var accountABalanceBeforeDeposit = BigNumber.from(0);
    var accountBBalanceBeforeDeposit = BigNumber.from(0);

    return {
      l1Provider,
      l2Provider,
      ...contracts,
      accounts: {
        accountA,
        accountB,
        l1Stranger: testing.accounts.stranger(l1Provider),
        l1ERC20ExtendedTokensBridgeAdmin,
        l2ERC20ExtendedTokensBridgeAdmin,
        l1CrossDomainMessengerAliased,
      },
      constants: {
        depositAmountOfRebasableToken,
        withdrawalAmountOfRebasableToken,
        tokenRate: exchangeRate,
        totalPooledEther,
        totalShares,
        tokenRateDecimals,
      },
      balances: {
        accountABalanceBeforeDeposit,
        accountBBalanceBeforeDeposit
      },
      snapshot: {
        l1: l1Snapshot,
        l2: l2Snapshot,
      },
    };
  }
}

function almostEqual(num1: BigNumber, num2: BigNumber) {
  const delta = (num1.sub(num2)).abs();
  return delta.lte(BigNumber.from('2'));
}

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging X rebasable token integration test ",
    ctxFactory(
      BigNumber.from('9309904612343950493629678'),
      BigNumber.from('7975822843597609202337218'),
      BigNumber.from(27),
      wei.toBigNumber(wei`0.001 ether`),
      wei.toBigNumber(wei`0.001 ether`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging 1 wei rebasable token integration test",
    ctxFactory(
      BigNumber.from('9309904612343950493629678'),
      BigNumber.from('7975822843597609202337218'),
      BigNumber.from(27),
      wei.toBigNumber(wei`1 wei`),
      wei.toBigNumber(wei`1 wei`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging Zero rebasable token integration test",
    ctxFactory(
      BigNumber.from('9309904612343950493629678'),
      BigNumber.from('7975822843597609202337218'),
      BigNumber.from(27),
      BigNumber.from('0'),
      BigNumber.from('0')
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging Big rebasable token integration test",
    ctxFactory(
      BigNumber.from('9309904612343950493629678'),
      BigNumber.from('7975822843597609202337218'),
      BigNumber.from(27),
      BigNumber.from(10).pow(27),
      BigNumber.from(10).pow(27).sub(2) // correct big number because during rounding looses 1-2 wei
      /// Thus, user can't withdraw the same amount
    )
  )
);

