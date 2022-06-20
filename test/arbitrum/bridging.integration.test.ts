import hre, { ethers } from "hardhat";
import testing from "../../utils/testing";
import {
  ArbSysStub__factory,
  BridgeStub__factory,
  ERC20Bridged__factory,
  ERC20BridgedStub__factory,
  IMessageProvider__factory,
  InboxStub__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  OutboxStub__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import { assert } from "chai";

import arbitrum from "../../utils/arbitrum";
import { Wallet } from "ethers";
import { BridgingManagement } from "../../utils/bridging-management";
import network from "../../utils/network";

let l1EVMSnapshotId: string;
let l2EVMSnapshotId: string;

testing.scenario("Arbitrum :: Bridging integration test", ctx, async (ctx) => {
  before(async () => {
    l1EVMSnapshotId = await ctx.l1.provider.send("evm_snapshot", []);
    l2EVMSnapshotId = await ctx.l2.provider.send("evm_snapshot", []);
  });

  it("1. Activate Bridging", async () => {
    const {
      l1: {
        l1ERC20TokenGateway,
        accounts: { admin: l1Admin },
      },
      l2: {
        l2ERC20TokenGateway,
        accounts: { admin: l2Admin },
      },
    } = ctx;

    const l1BridgingManagement = new BridgingManagement(
      l1ERC20TokenGateway.address,
      l1Admin
    );

    await l1BridgingManagement.setup({
      bridgeAdmin: l1Admin.address,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [l1Admin.address],
      withdrawalsEnablers: [l1Admin.address],
    });

    const l2BridgingManagement = new BridgingManagement(
      l2ERC20TokenGateway.address,
      l2Admin
    );

    await l2BridgingManagement.setup({
      bridgeAdmin: l2Admin.address,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      depositsEnablers: [l2Admin.address],
      withdrawalsEnablers: [l2Admin.address],
    });

    assert.isTrue(await l1ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenGateway.isWithdrawalsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isWithdrawalsEnabled());
  });

  it("2. Set L1ERC20TokenGateway for new token in L1GatewayRouter", async () => {
    const { l1GatewayRouterAdmin } = ctx.l1.accounts;
    const { l1GatewayRouter, l1ERC20TokenGateway, l1Token } = ctx.l1;
    const { maxGas, gasPriceBid, maxSubmissionCost, callValue } = ctx.common;

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
  });

  it("3. Set L2ERC20TokenGateway for new token in L2GatewayRouter", async () => {
    const { l1Token } = ctx.l1;
    const { l2GatewayRouter, l2ERC20TokenGateway } = ctx.l2;
    const { l1GatewayRouterAliased } = ctx.l2.accounts;

    await l2GatewayRouter
      .connect(l1GatewayRouterAliased)
      .setGateway([l1Token.address], [l2ERC20TokenGateway.address]);

    assert.equal(
      await l2GatewayRouter.getGateway(l1Token.address),
      l2ERC20TokenGateway.address
    );
  });

  it("4. Sender bridges tokens to himself via L1GatewayRouter", async () => {
    const { sender } = ctx.l1.accounts;
    const { l1Token, l1ERC20TokenGateway, l1GatewayRouter } = ctx.l1;
    const { l2ERC20TokenGateway } = ctx.l2;
    const { amount, outbdoundTransferData, maxGas, gasPriceBid, callValue } =
      ctx.common;

    await l1Token.connect(sender).approve(l1ERC20TokenGateway.address, amount);

    const senderBalanceBefore = await l1Token.balanceOf(sender.address);
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      l1ERC20TokenGateway.address
    );

    const tx = await l1GatewayRouter
      .connect(sender)
      .outboundTransfer(
        l1Token.address,
        sender.address,
        amount,
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
      l2ERC20TokenGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [l1Token.address, sender.address, sender.address, amount, "0x"]
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
      await l1Token.balanceOf(sender.address),
      senderBalanceBefore.sub(amount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1ERC20TokenGateway.address),
      l1ERC20TokenGatewayBalanceBefore.add(amount)
    );
  });

  it("5. Finalize bridging via finalizeInboundTransfer() on L2", async () => {
    const { l1Token } = ctx.l1;
    const { amount } = ctx.common;
    const { sender } = ctx.l1.accounts;
    const { l2Token, l2ERC20TokenGateway } = ctx.l2;
    const { l1ERC20TokenGatewayAliased } = ctx.l2.accounts;

    const finalizeDepositMessage =
      l2ERC20TokenGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [l1Token.address, sender.address, sender.address, amount, "0x"]
      );

    const tx = await l1ERC20TokenGatewayAliased.sendTransaction({
      to: l2ERC20TokenGateway.address,
      data: finalizeDepositMessage,
    });

    await assert.emits(l2Token, tx, "Transfer", [
      ethers.constants.AddressZero,
      sender.address,
      amount,
    ]);
    await assert.emits(l2ERC20TokenGateway, tx, "DepositFinalized", [
      l1Token.address,
      sender.address,
      sender.address,
      amount,
    ]);
    assert.equalBN(await l2Token.totalSupply(), amount);
    assert.equalBN(await l2Token.balanceOf(sender.address), amount);
  });

  it("6. Sender withdraws tokens to himself from via L2GatewayRouter", async () => {
    const { sender } = ctx.l2.accounts;
    const { l1Token, l1ERC20TokenGateway } = ctx.l1;
    const { amount } = ctx.common;
    const { l2GatewayRouter, l2Token, arbSysStub, l2ERC20TokenGateway } =
      ctx.l2;

    const tx = await l2GatewayRouter
      .connect(sender)
      ["outboundTransfer(address,address,uint256,bytes)"](
        l1Token.address,
        sender.address,
        amount,
        "0x"
      );

    await assert.emits(l2Token, tx, "Transfer", [
      sender.address,
      ethers.constants.AddressZero,
      amount,
    ]);

    const finalizeDepositMessage =
      l2ERC20TokenGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [l1Token.address, sender.address, sender.address, amount, "0x"]
      );

    await assert.emits(arbSysStub, tx, "CreateL2ToL1Tx", [
      l1ERC20TokenGateway.address,
      finalizeDepositMessage,
    ]);

    await assert.emits(l2ERC20TokenGateway, tx, "WithdrawalInitiated", [
      l1Token.address,
      sender.address,
      sender.address,
      0,
      0,
      amount,
    ]);
  });

  after(async () => {
    await ctx.l1.provider.send("evm_revert", [l1EVMSnapshotId]);
    await ctx.l2.provider.send("evm_revert", [l2EVMSnapshotId]);
  });
});

async function ctx() {
  const privateKeys = {
    deployer:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    sender:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    recipient:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  };
  const {
    l1: { signer: l1Deployer, provider: l1Provider },
    l2: { signer: l2Deployer, provider: l2Provider },
  } = network.getMultichainNetwork("arbitrum", "local", privateKeys.deployer);

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );

  const arbSysStub = await new ArbSysStub__factory(l2Deployer).deploy();

  const outboxStub = await new OutboxStub__factory(l1Deployer).deploy();
  const bridgeStub = await new BridgeStub__factory(l1Deployer).deploy(
    outboxStub.address
  );
  const inboxStub = await new InboxStub__factory(l1Deployer).deploy(
    bridgeStub.address
  );

  const [l1DeployScript, l2DeployScript] =
    await arbitrum.deployment.createGatewayDeployScripts(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2Deployer.address, bridge: l2Deployer.address },
      },
      {
        dependencies: {
          l2: { arbSys: arbSysStub.address },
        },
      }
    );

  await l1DeployScript.run();
  await l2DeployScript.run();

  const l2Token = ERC20Bridged__factory.connect(
    l2DeployScript.getContractAddress(1),
    l2Deployer
  );
  const l2ERC20TokenGateway = L2ERC20TokenGateway__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );
  const l1ERC20TokenGateway = L1ERC20TokenGateway__factory.connect(
    l1DeployScript.getContractAddress(1),
    l1Deployer
  );

  const l1GatewayRouterAdmin = await arbitrum.accounts.l1.L1GatewayRouterAdmin(
    l1Provider
  );
  const l1GatewayRouter = await arbitrum.contracts.l1.L1GatewayRouter(
    l1GatewayRouterAdmin
  );

  const l1ERC20TokenGatewayAliased = await testing.impersonate(
    applyL1ToL2Alias(l1ERC20TokenGateway.address),
    l2Provider
  );

  const l1GatewayRouterAliased = await testing.impersonate(
    applyL1ToL2Alias(l1GatewayRouter.address),
    l2Provider
  );

  await l2Deployer.sendTransaction({
    to: await l1ERC20TokenGatewayAliased.getAddress(),
    value: wei`1 ether`,
  });

  const l2GatewayRouter = await arbitrum.contracts.l2.L2GatewayRouter(
    l2Deployer
  );

  const amount = wei`1 ether`;
  const maxSubmissionCost = wei`200_000 gwei`;

  const l1Sender = new Wallet(privateKeys.sender, l1Provider);
  const l1Recipient = new Wallet(privateKeys.recipient, l1Provider);
  await l1Token.transfer(l1Sender.address, wei`100 ether`);

  await outboxStub.setL2ToL1Sender(l2ERC20TokenGateway.address);

  return {
    l1: {
      l1Token,
      l1ERC20TokenGateway,
      stubs: {
        inboxStub,
        outboxStub,
        bridgeStub,
      },
      accounts: {
        admin: l1Deployer,
        sender: l1Sender,
        recipient: l1Recipient,
        l1GatewayRouterAdmin,
      },
      l1GatewayRouter: l1GatewayRouter.connect(l1Sender),
      provider: l1Provider,
    },
    l2: {
      l2Token,
      l2GatewayRouter,
      l2ERC20TokenGateway,
      arbSysStub,
      accounts: {
        admin: l2Deployer,
        sender: new Wallet(privateKeys.sender, l2Provider),
        recipient: new Wallet(privateKeys.recipient, l2Provider),
        l1GatewayRouterAliased,
        l1ERC20TokenGatewayAliased,
      },
      provider: l2Provider,
    },
    common: {
      amount,
      maxGas: wei`300_000 gwei`,
      gasPriceBid: wei`1 wei`,
      callValue: wei`500_000 gwei`,
      maxSubmissionCost,
      // data for outboundTransfer must contain encoded tuple with (maxSubmissionCost, emptyData)
      outbdoundTransferData: ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [maxSubmissionCost, "0x"]
      ),
      finalizeInboundTransferCalldata:
        l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [l1Token.address, l1Sender.address, l1Recipient.address, amount, "0x"]
        ),
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
