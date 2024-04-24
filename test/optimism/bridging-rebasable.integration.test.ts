import { assert } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from 'ethers'
import { JsonRpcProvider } from "@ethersproject/providers";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ERC20WrapperStub } from "../../typechain";
import { ScenarioTest } from "../../utils/testing";

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
        l1LidoTokensBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        l1Provider
      } = ctx;
      const { accountA: tokenHolderA } = ctx.accounts;
      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasable(depositAmountOfRebasableToken, tokenRate);

      await l1TokenRebasable
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmountOfRebasableToken);

      const rebasableTokenHolderBalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceBefore = await l1TokenRebasable.balanceOf(l1Token.address);

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20(
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          depositAmountOfRebasableToken,
          200_000,
          "0x"
        );

      const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

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
      const warappedRebasableTokenBalanceAfter = await l1TokenRebasable.balanceOf(l1Token.address);


      assert.equalBN(
        rebasableTokenHolderBalanceAfter,
        rebasableTokenHolderBalanceBefore.sub(depositAmountOfRebasableToken)
      );

      const balanceDelta = nonRebasableTokenBridgeBalanceAfter.sub(nonRebasableTokenBridgeBalanceBefore);
      const oneTwoWei = BigNumber.from(depositAmountNonRebasable).sub(balanceDelta);
      assert.isTrue(oneTwoWei.gte(0) && oneTwoWei.lte(2));

      assert.equalBN(
        warappedRebasableTokenBalanceAfter,
        warappedRebasableTokenBalanceBefore.add(depositAmountOfRebasableToken)
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l2TokenRebasable,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        l2Provider
      } = ctx;

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasable(depositAmountOfRebasableToken, tokenRate);
      const depositAmountRebasable = rebasableFromNonRebasable(depositAmountNonRebasable, tokenRate);

      const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } = ctx.accounts;

      const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();

      const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

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
      const {
        l1TokenRebasable,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge
      } = ctx;
      const { withdrawalAmountOfRebasableToken } = ctx.constants;

      const tokenHolderABalanceBefore = await l2TokenRebasable.balanceOf(tokenHolderA.address);
      const l2TotalSupplyBefore = await l2TokenRebasable.totalSupply();

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
      const { withdrawalAmountOfRebasableToken, tokenRate } = ctx.constants;

      const withdrawalAmountNonRebasable = nonRebasableFromRebasable(withdrawalAmountOfRebasableToken, tokenRate);
      const withdrawalAmountRebasable = rebasableFromNonRebasable(withdrawalAmountNonRebasable, tokenRate);

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

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
      );
    })

    .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {

      const {
        l1Token,
        l1TokenRebasable,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        l1Provider
      } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
      assert.notEqual(tokenHolderA.address, tokenHolderB.address);

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasable(depositAmountOfRebasableToken, tokenRate);

      const rebasableTokenHolderBalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceBefore = await l1TokenRebasable.balanceOf(l1Token.address);

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

      const dataToSend = await packedTokenRateAndTimestamp(l1Provider, l1Token);

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

      const rebasableTokenHolderBalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const warappedRebasableTokenBalanceAfter = await l1TokenRebasable.balanceOf(l1Token.address);

      assert.equalBN(
        rebasableTokenHolderBalanceAfter,
        rebasableTokenHolderBalanceBefore.sub(depositAmountOfRebasableToken)
      );

      const balanceDelta = nonRebasableTokenBridgeBalanceAfter.sub(nonRebasableTokenBridgeBalanceBefore);
      const oneTwoWei = BigNumber.from(depositAmountNonRebasable).sub(balanceDelta);
      assert.isTrue(oneTwoWei.gte(0) && oneTwoWei.lte(2));

      assert.equalBN(
        warappedRebasableTokenBalanceAfter,
        warappedRebasableTokenBalanceBefore.add(depositAmountOfRebasableToken)
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        l2Provider
      } = ctx;

      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1CrossDomainMessengerAliased,
      } = ctx.accounts;

      const { depositAmountOfRebasableToken, tokenRate } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasable(depositAmountOfRebasableToken, tokenRate);
      const depositAmountRebasable = rebasableFromNonRebasable(depositAmountNonRebasable, tokenRate);

      const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.totalSupply();

      const tokenHolderBBalanceBefore = await l2TokenRebasable.balanceOf(
        tokenHolderB.address
      );

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

      const { withdrawalAmountOfRebasableToken, tokenRate } = ctx.constants;

      const withdrawalAmountNonRebasable = nonRebasableFromRebasable(withdrawalAmountOfRebasableToken, tokenRate);
      const withdrawalAmountRebasable = rebasableFromNonRebasable(withdrawalAmountNonRebasable, tokenRate);

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

      assert.equalBN(
        l1LidoTokensBridgeBalanceAfter,
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable)
      );

      assert.equalBN(
        tokenHolderABalanceAfter,
        tokenHolderABalanceBefore.add(withdrawalAmountRebasable)
      );
    })
    .run();
}

function ctxFactory(depositAmountOfRebasableToken: BigNumber, withdrawalAmountOfRebasableToken: BigNumber) {
  return async () => {
    const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");

    const {
      l1Provider,
      l2Provider,
      l1ERC20ExtendedTokensBridgeAdmin,
      l2ERC20ExtendedTokensBridgeAdmin,
      ...contracts
    } = await optimism.testing(networkName).getIntegrationTestSetup();

    const l1Snapshot = await l1Provider.send("evm_snapshot", []);
    const l2Snapshot = await l2Provider.send("evm_snapshot", []);

    await optimism.testing(networkName).stubL1CrossChainMessengerContract();

    const accountA = testing.accounts.accountA(l1Provider, l2Provider);
    const accountB = testing.accounts.accountB(l1Provider, l2Provider);

    const exchangeRate = BigNumber.from('1164454276599657236');
    const depositAmountRebasable = wei.toBigNumber(wei`0.15 ether`);

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
        tokenRate: exchangeRate
      },
      snapshot: {
        l1: l1Snapshot,
        l2: l2Snapshot,
      },
    };
  }
}

async function packedTokenRateAndTimestamp(l1Provider: JsonRpcProvider, l1Token: ERC20WrapperStub) {
  const stEthPerToken = await l1Token.stEthPerToken();
  const blockNumber = await l1Provider.getBlockNumber();
  const blockTimestamp = (await l1Provider.getBlock(blockNumber)).timestamp;
  const stEthPerTokenStr = ethers.utils.hexZeroPad(stEthPerToken.toHexString(), 12);
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);
  return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr]);
}

function nonRebasableFromRebasable(rebasable: BigNumber, exchangeRate: BigNumber) {
  return BigNumber.from(rebasable)
    .mul(BigNumber.from('1000000000000000000'))
    .div(exchangeRate);
}

function rebasableFromNonRebasable(nonRebasable: BigNumber, exchangeRate: BigNumber) {
  return BigNumber.from(nonRebasable)
    .mul(exchangeRate)
    .div(BigNumber.from('1000000000000000000'));
}

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging X rebasable token integration test ",
    ctxFactory(
      wei.toBigNumber(wei`0.001 ether`),
      wei.toBigNumber(wei`0.001 ether`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging Zero rebasable token integration test",
    ctxFactory(
      BigNumber.from('0'),
      BigNumber.from('0')
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging 1 wei rebasable token integration test",
    ctxFactory(
      wei.toBigNumber(wei`1 wei`),
      wei.toBigNumber(wei`1 wei`)
    )
  )
);

function almostEqual(num1: BigNumber, num2: BigNumber) {
  const delta = (num1.sub(num2)).abs();
  return delta.lte(BigNumber.from('2'));
}
