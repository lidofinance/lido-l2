import {
  getL2Network,
  L1TransactionReceipt,
  L1ToL2MessageStatus,
} from "@arbitrum/sdk";
import { assert } from "chai";
import { ContractReceipt } from "ethers";

import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  Inbox__factory,
  L2ERC20TokenGateway__factory,
  GovBridgeExecutor__factory,
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  createArbitrumVoting as createDAOVoting,
  sleep,
} from "../../utils/testing/e2e";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import { scenario } from "../../utils/testing";

let upgradeMessageResponse: ContractReceipt;
let ossifyMessageResponse: ContractReceipt;

scenario("Arbitrum :: AAVE governance crosschain bridge", ctxFactory)
  .step("LDO Holder has enought ETH", async ({ l1LDOHolder, gasAmount }) => {
    assert.gte(await l1LDOHolder.getBalance(), gasAmount);
  })

  .step("L2 Tester has enought ETH", async ({ l2Tester, gasAmount }) => {
    assert.gte(await l2Tester.getBalance(), gasAmount);
  })

  .step(
    "L2 Agent has enought ETH",
    async ({ l1Provider, agent, gasAmount }) => {
      assert.gte(await l1Provider.getBalance(agent.address), gasAmount);
    }
  )
  .step("Check OssifiableProxy deployed correct", async (ctx) => {
    const { proxyToOssify } = ctx;
    const admin = await proxyToOssify.proxy__getAdmin();

    assert.equal(admin, E2E_TEST_CONTRACTS.l2.govBridgeExecutor);
  })

  .step("Proxy upgrade: send crosschain message", async (ctx) => {
    const implBefore = await await ctx.proxyToOssify.proxy__getImplementation();

    assert.equal(implBefore, ctx.l2ERC20TokenGateway.address);
    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.proxyToOssify.address],
        [0],
        ["proxy__upgradeTo(address)"],
        [
          "0x" +
            ctx.proxyToOssify.interface
              .encodeFunctionData("proxy__upgradeTo", [ctx.l2Token.address])
              .substring(10),
        ],
        [false],
      ]);

    await createDAOVoting(ctx, executorCalldata);
  })

  .step("Proxy upgrade: Enacting Voting", async ({ voting }) => {
    const votesLength = await voting.votesLength();
    const targetVote = votesLength.toNumber() - 1;

    const voteTx = await voting.vote(targetVote, true, true);
    await voteTx.wait();

    while ((await voting.getVotePhase(targetVote)) < 2) {
      await sleep(5000);
    }

    const enactTx = await voting.executeVote(targetVote);
    upgradeMessageResponse = await enactTx.wait();
  })

  .step("Proxy upgrade: Waiting for L2 tx", async ({ l2Tester }) => {
    const l1TxReceipt = new L1TransactionReceipt(upgradeMessageResponse);
    const message = await l1TxReceipt.getL1ToL2Message(l2Tester);

    const { status } = await message.waitForStatus();
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const response = await message.redeem();
      await response.wait();
    }
  })

  .step(
    "Proxy upgrade: Execute queued task",
    async ({ govBridgeExecutor, l2Tester }) => {
      const tasksCount = await govBridgeExecutor.getActionsSetCount();

      const targetTask = tasksCount.toNumber() - 1;

      const executionTime = (
        await govBridgeExecutor.getActionsSetById(targetTask)
      ).executionTime.toNumber();
      let chainTime;

      do {
        await sleep(5000);
        const currentBlockNumber = await l2Tester.provider.getBlockNumber();
        const currentBlock = await l2Tester.provider.getBlock(
          currentBlockNumber
        );
        chainTime = currentBlock.timestamp;
      } while (chainTime <= executionTime);

      const tx = await govBridgeExecutor.execute(targetTask, {
        gasLimit: 1000000,
      });
      await tx.wait();
    }
  )

  .step("Proxy upgrade: check state", async ({ proxyToOssify, l2Token }) => {
    const implAfter = await await proxyToOssify.proxy__getImplementation();
    assert.equal(implAfter, l2Token.address);
  })

  .step("Proxy ossify: send crosschain message", async (ctx) => {
    const isOssifiedBefore = await ctx.proxyToOssify.proxy__getIsOssified();
    assert.isFalse(isOssifiedBefore);

    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.proxyToOssify.address],
        [0],
        ["proxy__ossify()"],
        ["0x00"],
        [false],
      ]);

    await createDAOVoting(ctx, executorCalldata);
  })

  .step("Proxy ossify: Enacting Voting", async ({ voting }) => {
    const votesLength = await voting.votesLength();
    const targetVote = votesLength.toNumber() - 1;

    const voteTx = await voting.vote(targetVote, true, true);
    await voteTx.wait();

    while ((await voting.getVotePhase(targetVote)) !== 2);

    const enactTx = await voting.executeVote(targetVote);
    ossifyMessageResponse = await enactTx.wait();
  })

  .step("Proxy ossify: Waiting for L2 tx", async ({ l2Tester }) => {
    const l1TxReceipt = new L1TransactionReceipt(ossifyMessageResponse);
    const message = await l1TxReceipt.getL1ToL2Message(l2Tester);

    const { status } = await message.waitForStatus();
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const response = await message.redeem();
      await response.wait();
    }
  })

  .step(
    "Proxy ossify: execute",
    async ({ govBridgeExecutor, proxyToOssify }) => {
      const taskId =
        (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1;
      const executeTx = await govBridgeExecutor.execute(taskId, {
        gasLimit: 2000000,
      });
      await executeTx.wait();
    }
  )

  .step("Proxy upgrade: check state", async ({ proxyToOssify, l2Token }) => {
    const isOssifiedAfter = await proxyToOssify.proxy__getIsOssified();

    assert.isTrue(isOssifiedAfter);
  })

  .run();

async function ctxFactory() {
  const pk = env.string("E2E_TESTER_PRIVATE_KEY");

  const {
    l1: { provider: l1Provider, signer: l1Tester },
    l2: { provider: l2Provider, signer: l2Tester },
  } = network.getMultichainNetwork("arbitrum", "testnet", pk);
  const ldoHolderPk = env.string("E2E_RINKEBY_LDO_HOLDER_PRIVATE_KEY");
  const {
    l1: { signer: l1LDOHolder },
  } = network.getMultichainNetwork("arbitrum", "testnet", ldoHolderPk);

  const l2Network = await getL2Network(l2Provider);

  // replace gateway router addresses with test
  l2Network.tokenBridge.l1GatewayRouter = E2E_TEST_CONTRACTS.l1.l1GatewayRouter;
  l2Network.tokenBridge.l2GatewayRouter = E2E_TEST_CONTRACTS.l2.l2GatewayRouter;

  return {
    gasAmount: wei`0.1 ether`,
    l1Tester,
    l2Tester,
    l1LDOHolder,
    l1Provider,
    l2Provider,
    l1Token: ERC20Mintable__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1Token,
      l1Tester
    ),
    l2Token: ERC20Bridged__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2Token,
      l2Tester
    ),
    l2ERC20TokenGateway: L2ERC20TokenGateway__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      l2Tester
    ),
    inbox: Inbox__factory.connect(E2E_TEST_CONTRACTS.l1.inbox, l1Tester),
    voting: Voting__factory.connect(
      E2E_TEST_CONTRACTS.l1.aragonVoting,
      l1LDOHolder
    ),
    agent: Agent__factory.connect(E2E_TEST_CONTRACTS.l1.agent, l1LDOHolder),
    tokenMnanager: TokenManager__factory.connect(
      E2E_TEST_CONTRACTS.l1.tokenManager,
      l1LDOHolder
    ),
    govBridgeExecutor: GovBridgeExecutor__factory.connect(
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      l2Tester
    ),
    l1LDOToken: ERC20Mintable__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1LDOToken,
      l1LDOHolder
    ),
    l2Network,
    proxyToOssify: await new OssifiableProxy__factory(l2Tester).deploy(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      "0x"
    ),
  };
}
