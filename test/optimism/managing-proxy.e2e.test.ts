import { assert } from "chai";
import { TransactionResponse } from "@ethersproject/providers";
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";

import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  GovBridgeExecutor__factory,
  Voting__factory,
  OssifiableProxy__factory,
  Agent__factory,
  TokenManager__factory,
  CrossDomainMessanger__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_OPTIMISM as E2E_TEST_CONTRACTS,
  createOptimismVoting,
  sleep,
} from "../../utils/testing/e2e";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import { scenario } from "../../utils/testing";

let ossifyMessageResponse: TransactionResponse;
let upgradeMessageResponse: TransactionResponse;

scenario(
  "Optimism :: AAVE governance crosschain bridge: proxy management",
  ctxFactory
)
  .step("Check OssifiableProxy deployed correct", async (ctx) => {
    const { proxyToOssify } = ctx;
    const admin = await proxyToOssify.proxy__getAdmin();

    assert.equal(admin, E2E_TEST_CONTRACTS.l2.govBridgeExecutor);
  })

  .step("Proxy upgrade: send crosschain message", async (ctx) => {
    const implBefore = await await ctx.proxyToOssify.proxy__getImplementation();

    assert.equal(implBefore, ctx.l2ERC20TokenBridge.address);
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

    await createOptimismVoting(ctx, executorCalldata);
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
    await enactTx.wait();

    upgradeMessageResponse = enactTx;
  })

  .step("Proxy upgrade: wait for relay", async ({ crossChainMessenger }) => {
    await crossChainMessenger.waitForMessageStatus(
      upgradeMessageResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step(
    "Proxy upgrade: execute",
    async ({ proxyToOssify, govBridgeExecutor, l2Token }) => {
      const taskId =
        (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1;

      const executeTx = await govBridgeExecutor.execute(taskId, {
        gasLimit: 1000000,
      });
      await executeTx.wait();
      const implAfter = await await proxyToOssify.proxy__getImplementation();

      assert(implAfter, l2Token.address);
    }
  )

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

    await createOptimismVoting(ctx, executorCalldata);
  })

  .step("Proxy ossify: Enacting Voting", async ({ voting }) => {
    const votesLength = await voting.votesLength();
    const targetVote = votesLength.toNumber() - 1;

    const voteTx = await voting.vote(targetVote, true, true);
    await voteTx.wait();

    while ((await voting.getVotePhase(targetVote)) !== 2) {
      await sleep(5000);
    }

    const enactTx = await voting.executeVote(targetVote);
    await enactTx.wait();

    ossifyMessageResponse = enactTx;
  })

  .step("Proxy ossify: wait for relay", async ({ crossChainMessenger }) => {
    await crossChainMessenger.waitForMessageStatus(
      ossifyMessageResponse.hash,
      MessageStatus.RELAYED
    );
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

      const isOssifiedAfter = await proxyToOssify.proxy__getIsOssified();

      assert.isTrue(isOssifiedAfter);
    }
  )

  .run();

async function ctxFactory() {
  const pk = env.string("E2E_TESTER_PRIVATE_KEY");
  const {
    l1: { signer: l1Tester },
    l2: { signer: l2Tester },
  } = network.getMultichainNetwork("optimism", "testnet", pk);
  const ldoHolderPk = env.string("E2E_KOVAN_LDO_HOLDER_PRIVATE_KEY");
  const {
    l1: { signer: l1LDOHolder },
  } = network.getMultichainNetwork("optimism", "testnet", ldoHolderPk);

  return {
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
    gasAmount: wei`0.1 ether`,
    l1Tester,
    l2Tester,
    l1LDOHolder,
    l1Token: ERC20Mintable__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1Token,
      l1Tester
    ),
    l2Token: ERC20Bridged__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2Token,
      l2Tester
    ),
    l1ERC20TokenBridge: L1ERC20TokenBridge__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1ERC20TokenBridge,
      l1Tester
    ),
    l2ERC20TokenBridge: L2ERC20TokenBridge__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenBridge,
      l2Tester
    ),
    crossChainMessenger: new CrossChainMessenger({
      l1SignerOrProvider: l1Tester,
      l2SignerOrProvider: l2Tester,
      l1ChainId: 42,
    }),
    l1CrossDomainMessenger: CrossDomainMessanger__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1CrossDomainMessenger,
      l1Tester
    ),
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
    proxyToOssify: await new OssifiableProxy__factory(l2Tester).deploy(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenBridge,
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      "0x"
    ),
  };
}
