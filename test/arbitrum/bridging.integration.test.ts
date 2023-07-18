import { assert } from "chai";
import { ethers } from "hardhat";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import arbitrum from "../../utils/arbitrum";
import arbitrumAddresses from "../../utils/arbitrum/addresses";
import testing, { scenario } from "../../utils/testing";
import {
  OutboxStub__factory,
  BridgeStub__factory,
  IMessageProvider__factory,
} from "../../typechain";

scenario("Arbitrum :: Bridging integration test", ctx)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate Bridging on L1", async (ctx) => {
    const { l1ERC20TokenGateway } = ctx;
    const { l1BridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l1ERC20TokenGateway.isDepositsEnabled();

    if (!isDepositsEnabled) {
      await l1ERC20TokenGateway.connect(l1BridgeAdmin).enableDeposits();
    } else {
      console.log("L1 deposits already enabled");
    }

    const isWithdrawalsEnabled =
      await l1ERC20TokenGateway.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l1ERC20TokenGateway.connect(l1BridgeAdmin).enableWithdrawals();
    } else {
      console.log("L1 withdrawals already enabled");
    }

    assert.isTrue(await l1ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenGateway.isWithdrawalsEnabled());
  })

  .step("Activate Bridging on L2", async (ctx) => {
    const { l2ERC20TokenGateway } = ctx;
    const { l2BridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l2ERC20TokenGateway.isDepositsEnabled();

    if (!isDepositsEnabled) {
      await l2ERC20TokenGateway.connect(l2BridgeAdmin).enableDeposits();
    } else {
      console.log("L2 deposits already enabled");
    }

    const isWithdrawalsEnabled =
      await l2ERC20TokenGateway.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l2ERC20TokenGateway.connect(l2BridgeAdmin).enableWithdrawals();
    } else {
      console.log("L2 withdrawals already enabled");
    }

    assert.isTrue(await l2ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isWithdrawalsEnabled());
  })

  .step(
    "Set L1ERC20TokenGateway for new token in L1GatewayRouter",
    async (ctx) => {
      const { l1ERC20TokenGateway, l1Token, l1GatewayRouter } = ctx;
      const { l1GatewayRouterAdmin } = ctx.accounts;
      const { maxGas, gasPriceBid, maxSubmissionCost, callValue } =
        ctx.constants;

      await l1GatewayRouter
        .connect(l1GatewayRouterAdmin)
        .setGateways(
          [l1Token.address],
          [l1ERC20TokenGateway.address],
          maxGas,
          gasPriceBid,
          maxSubmissionCost,
          { value: callValue }
        );

      assert.equal(
        await l1GatewayRouter.getGateway(l1Token.address),
        l1ERC20TokenGateway.address
      );
    }
  )

  .step(
    "Set L2ERC20TokenGateway for new token in L2GatewayRouter",
    async (ctx) => {
      const { l1Token, l2GatewayRouter, l2ERC20TokenGateway } = ctx;
      const { l1GatewayRouterAliased } = ctx.accounts;

      await l2GatewayRouter
        .connect(l1GatewayRouterAliased)
        .setGateway([l1Token.address], [l2ERC20TokenGateway.address]);

      assert.equal(
        await l2GatewayRouter.getGateway(l1Token.address),
        l2ERC20TokenGateway.address
      );
    }
  )

  .step("L1 -> L2 deposit via L1GatewayRouter", async (ctx) => {
    const { accountA, accountB } = ctx.accounts;
    const { l1Token, l1ERC20TokenGateway } = ctx;
    const {
      depositAmount,
      outbdoundTransferData,
      maxGas,
      gasPriceBid,
      callValue,
    } = ctx.constants;

    await l1Token
      .connect(accountA.l1Signer)
      .approve(l1ERC20TokenGateway.address, depositAmount);

    const accountABalanceBefore = await l1Token.balanceOf(accountA.address);
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenGateway.address
    );

    const tx = await ctx.l1GatewayRouter
      .connect(accountA.l1Signer)
      .outboundTransfer(
        l1Token.address,
        accountB.address,
        depositAmount,
        maxGas,
        gasPriceBid,
        outbdoundTransferData,
        { value: callValue }
      );

    const receipt = await tx.wait();

    const messageProviderInterface =
      IMessageProvider__factory.createInterface();
    const inboxMessageDeliveredTopic = messageProviderInterface.getEventTopic(
      "InboxMessageDelivered"
    );
    const messageDeliveredLog = receipt.logs.find(
      (l) => l.topics[0] === inboxMessageDeliveredTopic
    );
    if (!messageDeliveredLog) {
      throw new Error("InboxMessageDelivered message wasn't fired");
    }
    const messageDeliveredEvent =
      messageProviderInterface.parseLog(messageDeliveredLog);

    // Validate that message data were passed correctly.
    // Inbox contract uses the abi.encodePackedValue(), so it's an overhead
    // to parse all data of the event when we only need the last one
    assert.isTrue(
      messageDeliveredEvent.args.data.endsWith(
        ctx.constants.finalizeInboundTransferCalldata.deposit.slice(2)
      )
    );

    assert.equalBN(
      await l1Token.balanceOf(accountA.address),
      accountABalanceBefore.sub(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenGateway.address),
      l1ERC20TokenGatewayBalanceBefore.add(depositAmount)
    );
  })

  .step("Finalize deposit on L2", async (ctx) => {
    const { depositAmount } = ctx.constants;
    const { l1Token, l2Token, l2ERC20TokenGateway } = ctx;
    const { accountA, accountB, l1ERC20TokenGatewayAliased } = ctx.accounts;

    const l2TokenSupplyBefore = await l2Token.totalSupply();
    const accountBBalanceBefore = await l2Token.balanceOf(accountB.address);

    const tx = await l1ERC20TokenGatewayAliased.sendTransaction({
      to: l2ERC20TokenGateway.address,
      data: ctx.constants.finalizeInboundTransferCalldata.deposit,
    });

    await assert.emits(l2Token, tx, "Transfer", [
      ethers.constants.AddressZero,
      accountB.address,
      depositAmount,
    ]);

    await assert.emits(l2ERC20TokenGateway, tx, "DepositFinalized", [
      l1Token.address,
      accountA.address,
      accountB.address,
      depositAmount,
    ]);

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenSupplyBefore.add(depositAmount)
    );
    assert.equalBN(
      await l2Token.balanceOf(accountB.address),
      accountBBalanceBefore.add(depositAmount)
    );
  })

  .step("L2 -> L1 withdrawal via L2GatewayRouter", async (ctx) => {
    const { accountA, accountB } = ctx.accounts;
    const { l1Token, arbSys, l2ERC20TokenGateway, l2Token } = ctx;
    const { withdrawalAmount } = ctx.constants;

    const l2TokenSupplyBefore = await l2Token.totalSupply();
    const accountBBalanceBefore = await l2Token.balanceOf(accountB.address);

    const prevL2ToL1TxId = await arbSys.l2ToL1TxId();
    const tx = await ctx.l2GatewayRouter
      .connect(accountB.l2Signer)
      ["outboundTransfer(address,address,uint256,bytes)"](
        l1Token.address,
        accountA.address,
        withdrawalAmount,
        "0x"
      );

    await assert.emits(ctx.l2Token, tx, "Transfer", [
      accountB.address,
      ethers.constants.AddressZero,
      withdrawalAmount,
    ]);

    await assert.emits(arbSys, tx, "CreateL2ToL1Tx", [
      ctx.l1ERC20TokenGateway.address,
      ctx.constants.finalizeInboundTransferCalldata.withdraw,
    ]);

    await assert.emits(l2ERC20TokenGateway, tx, "WithdrawalInitiated", [
      l1Token.address,
      accountB.address,
      accountA.address,
      prevL2ToL1TxId.add(1),
      0,
      withdrawalAmount,
    ]);

    assert.equalBN(
      await l2Token.totalSupply(),
      l2TokenSupplyBefore.sub(withdrawalAmount)
    );
    assert.equalBN(
      await l2Token.balanceOf(accountB.address),
      accountBBalanceBefore.sub(withdrawalAmount)
    );
  })

  .step("Finalize withdrawal on L1", async (ctx) => {
    const { accountA, accountB } = ctx.accounts;
    const { withdrawalAmount } = ctx.constants;
    const {
      l1OutboxStub,
      l1Provider,
      l1Token,
      l1ERC20TokenGateway,
      l1Bridge,
      l1BridgeStub,
    } = ctx;

    const accountABalanceBefore = await l1Token.balanceOf(accountA.address);
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenGateway.address
    );

    const [bridgeCodeBefore, bridgeStubCode] = await Promise.all([
      l1Provider.send("eth_getCode", [l1Bridge.address]),
      l1Provider.send("eth_getCode", [l1BridgeStub.address]),
    ]);

    await l1Provider.send("hardhat_setCode", [
      l1Bridge.address,
      bridgeStubCode,
    ]);
    const bridgeCodeAfter = await l1Provider.send("eth_getCode", [
      l1Bridge.address,
    ]);

    const l1BridgeEOA = await testing.impersonate(l1Bridge.address, l1Provider);

    await l1Bridge.setOutbox(l1OutboxStub.address);

    assert.equal(bridgeStubCode, bridgeCodeAfter);
    assert.notEqual(bridgeCodeBefore, bridgeCodeAfter);

    const tx = await l1BridgeEOA.sendTransaction({
      to: l1ERC20TokenGateway.address,
      data: ctx.constants.finalizeInboundTransferCalldata.withdraw,
    });

    await tx.wait();

    await assert.emits(l1ERC20TokenGateway, tx, "WithdrawalFinalized", [
      l1Token.address,
      accountB.address,
      accountA.address,
      0,
      withdrawalAmount,
    ]);

    assert.equalBN(
      accountABalanceBefore.add(withdrawalAmount),
      await l1Token.balanceOf(accountA.address)
    );

    assert.equalBN(
      l1ERC20TokenGatewayBalanceBefore.sub(withdrawalAmount),
      await l1Token.balanceOf(l1ERC20TokenGateway.address)
    );
  })

  .run();

async function ctx() {
  const networkName = env.network("TESTING_ARB_NETWORK", "mainnet");
  const {
    l1Provider,
    l2Provider,
    l1ERC20TokenGatewayAdmin,
    l2ERC20TokenGatewayAdmin,
    ...contracts
  } = await arbitrum.testing(networkName).getIntegrationTestSetup();

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  // by default arbSys contract doesn't exist on the hardhat fork
  // so we have to deploy there a stub contract
  await arbitrum.testing(networkName).stubArbSysContract();

  const accountA = testing.accounts.accountA(l1Provider, l2Provider);
  const accountB = testing.accounts.accountB(l1Provider, l2Provider);

  const l1TokensHolderAddress = await contracts.l1TokensHolder.getAddress();

  await accountA.l1Signer.sendTransaction({
    value: wei`1 ether`,
    to: l1TokensHolderAddress,
  });

  const depositAmount = wei`0.15 ether`;
  const withdrawalAmount = wei`0.05 ether`;

  await contracts.l1Token
    .connect(contracts.l1TokensHolder)
    .transfer(accountA.address, depositAmount);

  const l1ERC20TokenGatewayAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1ERC20TokenGateway.address),
    l2Provider
  );

  const l1GatewayRouterAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1GatewayRouter.address),
    l2Provider
  );

  await accountA.l1Signer.sendTransaction({
    to: await contracts.l1TokensHolder.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await accountA.l1Signer.sendTransaction({
    to: await l1ERC20TokenGatewayAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await accountA.l2Signer.sendTransaction({
    to: await l2ERC20TokenGatewayAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  // send ether to l1GatewayRouterAliased to run transactions from it
  // as from EOA
  await accountA.l2Signer.sendTransaction({
    to: await l1GatewayRouterAliased.getAddress(),
    value: wei`1 ether`,
  });

  // send ether to l1ERC20TokenGatewayAliased to run transactions from it
  // as from EOA

  await testing.setBalance(
    await l1ERC20TokenGatewayAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  const maxSubmissionCost = wei`200_000 gwei`;

  const l1GatewayRouterAdminAddress = await contracts.l1GatewayRouter.owner();

  const l1GatewayRouterAdmin = await testing.impersonate(
    l1GatewayRouterAdminAddress,
    l1Provider
  );

  await testing.setBalance(
    l1GatewayRouterAdminAddress,
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  const l1OutboxStub = await new OutboxStub__factory(
    accountA.l1Signer
  ).deploy();

  await l1OutboxStub.setL2ToL1Sender(contracts.l2ERC20TokenGateway.address);

  const l1BridgeStub = await new BridgeStub__factory(accountA.l1Signer).deploy(
    l1OutboxStub.address
  );

  const { Bridge: l1BridgeAddress } = arbitrumAddresses(networkName);
  const l1Bridge = BridgeStub__factory.connect(
    l1BridgeAddress,
    accountA.l1Signer
  );

  return {
    l1Provider,
    l2Provider,
    l1Bridge,
    l1BridgeStub,
    l1OutboxStub,
    l1Token: contracts.l1Token,
    l2Token: contracts.l2Token,
    l2GatewayRouter: contracts.l2GatewayRouter,
    l2ERC20TokenGateway: contracts.l2ERC20TokenGateway,
    arbSys: contracts.arbSysStub,
    l1GatewayRouter: contracts.l1GatewayRouter,
    l1ERC20TokenGateway: contracts.l1ERC20TokenGateway,
    accounts: {
      accountA,
      accountB,
      l1BridgeAdmin: l1ERC20TokenGatewayAdmin,
      l1GatewayRouterAdmin,
      l2BridgeAdmin: l2ERC20TokenGatewayAdmin,
      l1GatewayRouterAliased,
      l1ERC20TokenGatewayAliased,
    },
    constants: {
      depositAmount,
      withdrawalAmount,
      maxGas: wei`300_000`,
      gasPriceBid: wei`1 gwei`,
      callValue: wei`500_000 gwei`,
      maxSubmissionCost,
      // data for outboundTransfer must contain encoded tuple with (maxSubmissionCost, emptyData)
      outbdoundTransferData: ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [maxSubmissionCost, "0x"]
      ),
      finalizeInboundTransferCalldata: {
        deposit: contracts.l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            contracts.l1Token.address,
            accountA.address,
            accountB.address,
            depositAmount,
            "0x",
          ]
        ),
        withdraw: contracts.l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            contracts.l1Token.address,
            accountB.address,
            accountA.address,
            withdrawalAmount,
            "0x",
          ]
        ),
      },
    },
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}
