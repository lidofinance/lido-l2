import { assert } from "chai";
import hre, { ethers } from "hardhat";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import arbitrum from "../../utils/arbitrum";
import testing, { scenario } from "../../utils/testing";
import { IMessageProvider__factory } from "../../typechain";
import { BridgingManagement } from "../../utils/bridging-management";

scenario("Arbitrum :: Bridging integration test", ctx)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate Bridging", async (ctx) => {
    const { l1ERC20TokenGateway, l2ERC20TokenGateway } = ctx;
    const { l1BridgeAdmin, l2BridgeAdmin } = ctx.accounts;

    const l1BridgingManagement = new BridgingManagement(
      l1ERC20TokenGateway.address,
      l1BridgeAdmin
    );

    const adminAddress = await l1BridgeAdmin.getAddress();

    await l1BridgingManagement.setup({
      bridgeAdmin: adminAddress,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [adminAddress],
      withdrawalsEnablers: [adminAddress],
    });

    const l2BridgingManagement = new BridgingManagement(
      l2ERC20TokenGateway.address,
      l2BridgeAdmin
    );

    await l2BridgingManagement.setup({
      bridgeAdmin: adminAddress,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [adminAddress],
      withdrawalsEnablers: [adminAddress],
    });

    assert.isTrue(await l1ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenGateway.isWithdrawalsEnabled());
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

  .step("Sender bridges tokens to himself via L1GatewayRouter", async (ctx) => {
    const { l1Sender } = ctx.accounts;
    const { l1Token, l1ERC20TokenGateway } = ctx;
    const {
      depositAmount,
      outbdoundTransferData,
      maxGas,
      gasPriceBid,
      callValue,
    } = ctx.constants;

    await l1Token
      .connect(l1Sender)
      .approve(l1ERC20TokenGateway.address, depositAmount);

    const senderBalanceBefore = await l1Token.balanceOf(l1Sender.address);
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenGateway.address
    );

    const tx = await ctx.l1GatewayRouter
      .connect(l1Sender)
      .outboundTransfer(
        l1Token.address,
        l1Sender.address,
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

    const expectedFinalizeDepositMessage =
      ctx.l2ERC20TokenGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [
          l1Token.address,
          l1Sender.address,
          l1Sender.address,
          depositAmount,
          "0x",
        ]
      );

    // Validate that message data were passed correctly.
    // Inbox contract uses the abi.encodePackedValue(), so it's an overhead
    // to parse all data of the event when we only need the last one
    assert.isTrue(
      messageDeliveredEvent.args.data.endsWith(
        expectedFinalizeDepositMessage.slice(2)
      )
    );

    assert.equalBN(
      await l1Token.balanceOf(l1Sender.address),
      senderBalanceBefore.sub(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenGateway.address),
      l1ERC20TokenGatewayBalanceBefore.add(depositAmount)
    );
  })

  .step(
    "Finalize bridging via finalizeInboundTransfer() on L2",
    async (ctx) => {
      const { depositAmount } = ctx.constants;
      const { l1Token, l2Token, l2ERC20TokenGateway } = ctx;
      const { l2Sender, l1ERC20TokenGatewayAliased } = ctx.accounts;

      const finalizeDepositMessage =
        l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            l1Token.address,
            l2Sender.address,
            l2Sender.address,
            depositAmount,
            "0x",
          ]
        );

      const l2TokenSupplyBefore = await l2Token.totalSupply();
      const l2TokenSenderBefore = await l2Token.balanceOf(l2Sender.address);

      const tx = await l1ERC20TokenGatewayAliased.sendTransaction({
        to: l2ERC20TokenGateway.address,
        data: finalizeDepositMessage,
      });

      await assert.emits(l2Token, tx, "Transfer", [
        ethers.constants.AddressZero,
        l2Sender.address,
        depositAmount,
      ]);
      await assert.emits(l2ERC20TokenGateway, tx, "DepositFinalized", [
        l1Token.address,
        l2Sender.address,
        l2Sender.address,
        depositAmount,
      ]);

      assert.equalBN(
        await l2Token.totalSupply(),
        l2TokenSupplyBefore.add(depositAmount)
      );
      assert.equalBN(
        await l2Token.balanceOf(l2Sender.address),
        l2TokenSenderBefore.add(depositAmount)
      );
    }
  )

  .step(
    "Sender withdraws tokens to himself via L2GatewayRouter",
    async (ctx) => {
      const { l2Sender } = ctx.accounts;
      const { l1Token, arbSysStub: arbSys, l2ERC20TokenGateway, l2Token } = ctx;
      const { withdrawalAmount } = ctx.constants;

      const l2TokenSupplyBefore = await l2Token.totalSupply();
      const l2TokenSenderBefore = await l2Token.balanceOf(l2Sender.address);

      const prevL2ToL1TxId = await arbSys.l2ToL1TxId();
      const tx = await ctx.l2GatewayRouter
        .connect(l2Sender)
        ["outboundTransfer(address,address,uint256,bytes)"](
          l1Token.address,
          l2Sender.address,
          withdrawalAmount,
          "0x"
        );

      await assert.emits(ctx.l2Token, tx, "Transfer", [
        l2Sender.address,
        ethers.constants.AddressZero,
        withdrawalAmount,
      ]);

      const finalizeDepositMessage =
        l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            l1Token.address,
            l2Sender.address,
            l2Sender.address,
            withdrawalAmount,
            "0x",
          ]
        );

      await assert.emits(arbSys, tx, "CreateL2ToL1Tx", [
        ctx.l1ERC20TokenGateway.address,
        finalizeDepositMessage,
      ]);

      await assert.emits(l2ERC20TokenGateway, tx, "WithdrawalInitiated", [
        l1Token.address,
        l2Sender.address,
        l2Sender.address,
        prevL2ToL1TxId.add(1),
        0,
        withdrawalAmount,
      ]);

      assert.equalBN(
        await l2Token.totalSupply(),
        l2TokenSupplyBefore.sub(withdrawalAmount)
      );
      assert.equalBN(
        await l2Token.balanceOf(l2Sender.address),
        l2TokenSenderBefore.sub(withdrawalAmount)
      );
    }
  )

  .run();

async function ctx() {
  const networkName = env.network();
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

  const l1Sender = testing.accounts.sender(l1Provider);
  const l2Sender = testing.accounts.sender(l2Provider);
  const l1Recipient = testing.accounts.recipient(l1Provider);
  const l2Recipient = testing.accounts.recipient(l2Provider);

  const l1TokensHolderAddress = await contracts.l1TokensHolder.getAddress();

  await l1Sender.sendTransaction({
    value: wei`1 ether`,
    to: l1TokensHolderAddress,
  });

  const depositAmount = wei`0.15 ether`;
  const withdrawalAmount = wei`0.05 ether`;

  await contracts.l1Token
    .connect(contracts.l1TokensHolder)
    .transfer(l1Sender.address, depositAmount);

  const l1ERC20TokenGatewayAliased = await testing.impersonate(
    applyL1ToL2Alias(contracts.l1ERC20TokenGateway.address),
    l2Provider
  );

  const l1GatewayRouterAliased = await testing.impersonate(
    applyL1ToL2Alias(contracts.l1GatewayRouter.address),
    l2Provider
  );

  await l1Sender.sendTransaction({
    to: await contracts.l1TokensHolder.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await l1Sender.sendTransaction({
    to: await l1ERC20TokenGatewayAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  await l2Sender.sendTransaction({
    to: await l2ERC20TokenGatewayAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  // send ether to l1GatewayRouterAliased to run transactions from it
  // as from EOA
  await l1Sender.sendTransaction({
    to: await l1GatewayRouterAliased.getAddress(),
    value: wei`1 ether`,
  });

  // send ether to l1ERC20TokenGatewayAliased to run transactions from it
  // as from EOA
  await l2Sender.sendTransaction({
    to: await l1ERC20TokenGatewayAliased.getAddress(),
    value: wei`1 ether`,
  });

  const maxSubmissionCost = wei`200_000 gwei`;

  const l1GatewayRouterAdminAddress = await contracts.l1GatewayRouter.owner();

  const l1GatewayRouterAdmin = await testing.impersonate(
    l1GatewayRouterAdminAddress,
    l1Provider
  );

  await l1Sender.sendTransaction({
    to: await l1GatewayRouterAdmin.getAddress(),
    value: wei.toBigNumber(wei`1 ether`),
  });

  return {
    l1Provider,
    l2Provider,
    l1Token: contracts.l1Token,
    l2Token: contracts.l2Token,
    l2GatewayRouter: contracts.l2GatewayRouter,
    l2ERC20TokenGateway: contracts.l2ERC20TokenGateway,
    arbSysStub: contracts.arbSysStub,
    l1GatewayRouter: contracts.l1GatewayRouter,
    l1ERC20TokenGateway: contracts.l1ERC20TokenGateway,
    accounts: {
      l1BridgeAdmin: l1ERC20TokenGatewayAdmin,
      l1Sender,
      l1Recipient,
      l1GatewayRouterAdmin,
      l2BridgeAdmin: l2ERC20TokenGatewayAdmin,
      l2Sender,
      l2Recipient,
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
      finalizeInboundTransferCalldata:
        contracts.l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            contracts.l1Token.address,
            l1Sender.address,
            l1Recipient.address,
            depositAmount,
            "0x",
          ]
        ),
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
