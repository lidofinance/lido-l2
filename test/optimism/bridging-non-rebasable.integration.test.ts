import { assert } from "chai";
import { BigNumber } from 'ethers'
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ScenarioTest } from "../../utils/testing";
import { tokenRateAndTimestampPacked, refSlotTimestamp, getExchangeRate } from "../../utils/testing/helpers";

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
        l1LidoTokensBridge,
        l2Token,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        accountingOracle
      } = ctx;
      const { accountA: tokenHolderA } = ctx.accounts;
      const { depositAmount, tokenRate } = ctx.constants;

      await l1Token
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmount);

      const tokenHolderABalanceBefore = await l1Token.balanceOf(tokenHolderA.address);
      const l1ERC20ExtendedTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      ctx.balances.accountABalanceBeforeDeposit = tokenHolderABalanceBefore;

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20(
          l1Token.address,
          l2Token.address,
          depositAmount,
          200_000,
          "0x"
        );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmount,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1Token.address,
          l2Token.address,
          tokenHolderA.address,
          tokenHolderA.address,
          depositAmount,
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

      assert.equalBN(
        await l1Token.balanceOf(l1LidoTokensBridge.address),
        l1ERC20ExtendedTokensBridgeBalanceBefore.add(depositAmount)
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
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        accountingOracle
      } = ctx;
      const { depositAmount, tokenRate } = ctx.constants;

      const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
        ctx.accounts;

      const tokenHolderABalanceBefore = await l2Token.balanceOf(tokenHolderA.address);
      const l2TokenTotalSupplyBefore = await l2Token.totalSupply();

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
            l1Token.address,
            l2Token.address,
            tokenHolderA.address,
            tokenHolderA.address,
            depositAmount,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
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
      const { withdrawalAmount } = ctx.constants;
      const { l1Token, l2Token, l2ERC20ExtendedTokensBridge } = ctx;

      const tokenHolderABalanceBefore = await l2Token.balanceOf(tokenHolderA.address);
      const l2TotalSupplyBefore = await l2Token.totalSupply();

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderA.l2Signer)
        .withdraw(l2Token.address, withdrawalAmount, 0, "0x");

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmount,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2Token.balanceOf(tokenHolderA.address);
      const l2TotalSupplyAfter = await l2Token.totalSupply();

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.sub(withdrawalAmount)
      );
      assert.equalBN(
        l2TotalSupplyAfter,
        l2TotalSupplyBefore.sub(withdrawalAmount)
      );
    })

    .step("Finalize withdrawal on L1", async (ctx) => {
      const {
        l1Token,
        l1CrossDomainMessenger,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2Token,
        l2ERC20ExtendedTokensBridge,
      } = ctx;
      const { accountA: tokenHolderA, l1Stranger } = ctx.accounts;
      const { depositAmount, withdrawalAmount } = ctx.constants;

      const tokenHolderABalanceBefore = await l1Token.balanceOf(
        tokenHolderA.address
      );
      const l1ERC20ExtendedTokensBridgeBalanceBefore = await l1Token.balanceOf(
        l1LidoTokensBridge.address
      );

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

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmount,
        "0x",
      ]);

      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const tokenHolderABalanceAfter = await l1Token.balanceOf(tokenHolderA.address);

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1ERC20ExtendedTokensBridgeBalanceBefore.sub(withdrawalAmount)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmount)
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawal = depositAmount.sub(withdrawalAmount);
      assert.equalBN(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawal)
      );
    })

    .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {
      const {
        l1Token,
        l2Token,
        l1LidoTokensBridge,
        l2ERC20ExtendedTokensBridge,
        l1CrossDomainMessenger,
        accountingOracle
      } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
      const { depositAmount, tokenRate } = ctx.constants;

      assert.notEqual(tokenHolderA.address, tokenHolderB.address);

      const tokenHolderABalanceBefore = await l1Token.balanceOf(tokenHolderA.address);
      const l1ERC20ExtendedTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      ctx.balances.accountABalanceBeforeDeposit = tokenHolderABalanceBefore;
      ctx.balances.accountBBalanceBeforeDeposit = await l2Token.balanceOf(tokenHolderB.address);

      await l1Token
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmount);

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20To(
          l1Token.address,
          l2Token.address,
          tokenHolderB.address,
          depositAmount,
          200_000,
          "0x"
        );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1Token.address,
        l2Token.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmount,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1Token.address,
          l2Token.address,
          tokenHolderA.address,
          tokenHolderB.address,
          depositAmount,
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

      assert.equalBN(
        await l1Token.balanceOf(l1LidoTokensBridge.address),
        l1ERC20ExtendedTokensBridgeBalanceBefore.add(depositAmount)
      );

      assert.equalBN(
        await l1Token.balanceOf(tokenHolderA.address),
        tokenHolderABalanceBefore.sub(depositAmount)
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1Token,
        l1LidoTokensBridge,
        l2Token,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        accountingOracle
      } = ctx;
      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1CrossDomainMessengerAliased,
      } = ctx.accounts;
      const { depositAmount, tokenRate } = ctx.constants;

      const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
      const tokenHolderBBalanceBefore = await l2Token.balanceOf(tokenHolderB.address);

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
            l1Token.address,
            l2Token.address,
            tokenHolderA.address,
            tokenHolderB.address,
            depositAmount,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
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
      const { l1Token, l2Token, l2ERC20ExtendedTokensBridge } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
      const { withdrawalAmount } = ctx.constants;

      const tokenHolderBBalanceBefore = await l2Token.balanceOf(
        tokenHolderB.address
      );
      const l2TotalSupplyBefore = await l2Token.totalSupply();

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderB.l2Signer)
        .withdrawTo(
          l2Token.address,
          tokenHolderA.address,
          withdrawalAmount,
          0,
          "0x"
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
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
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2Token,
        l2ERC20ExtendedTokensBridge,
      } = ctx;
      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1Stranger,
      } = ctx.accounts;
      const { depositAmount, withdrawalAmount } = ctx.constants;

      const tokenHolderABalanceBefore = await l1Token.balanceOf(
        tokenHolderA.address
      );
      const l1ERC20ExtendedTokensBridgeBalanceBefore = await l1Token.balanceOf(
        l1LidoTokensBridge.address
      );

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

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1Token.address,
        l2Token.address,
        tokenHolderB.address,
        tokenHolderA.address,
        withdrawalAmount,
        "0x",
      ]);

      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const tokenHolderABalanceAfter = await l1Token.balanceOf(tokenHolderA.address);
      const tokenHolderBBalanceAfter = await l2Token.balanceOf(tokenHolderB.address);

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1ERC20ExtendedTokensBridgeBalanceBefore.sub(withdrawalAmount)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmount)
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawal = depositAmount.sub(withdrawalAmount);
      assert.equalBN(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawal)
      );
      assert.equalBN(
        ctx.balances.accountBBalanceBeforeDeposit,
        tokenHolderBBalanceAfter.sub(deltaDepositWithdrawal)
      );
    })

    .run();
}

function ctxFactory(depositAmount: BigNumber, withdrawalAmount: BigNumber) {
  return async () => {
    const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");
    const tokenRateDecimals = BigNumber.from(27);
    const totalPooledEther = BigNumber.from('9309904612343950493629678');
    const totalShares = BigNumber.from('7975822843597609202337218');

    const {
      l1Provider,
      l2Provider,
      l1ERC20ExtendedTokensBridgeAdmin,
      l2ERC20ExtendedTokensBridgeAdmin,
      ...contracts
    } = await optimism.testing(networkName).getIntegrationTestSetup(totalPooledEther, totalShares);

    const l1Snapshot = await l1Provider.send("evm_snapshot", []);
    const l2Snapshot = await l2Provider.send("evm_snapshot", []);

    const tokenRate =  await contracts.l1Token.getStETHByWstETH(BigNumber.from(10).pow(tokenRateDecimals));

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

    await contracts.l1Token
      .connect(contracts.l1TokensHolder)
      .transfer(accountA.l1Signer.address, depositAmount.mul(2));

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
        depositAmount,
        withdrawalAmount,
        tokenRate
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

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging X non-rebasable token integration test",
    ctxFactory(
      wei.toBigNumber(wei`0.001 ether`),
      wei.toBigNumber(wei`0.001 ether`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging 1 wei non-rebasable token integration test",
    ctxFactory(
      wei.toBigNumber(wei`1 wei`),
      wei.toBigNumber(wei`1 wei`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging zero non-rebasable token integration test",
    ctxFactory(
      BigNumber.from('0'),
      BigNumber.from('0')
    )
  )
);
