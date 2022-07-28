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
  Agent__factory,
  TokenManager__factory,
  CrossDomainMessanger__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_OPTIMISM as E2E_TEST_CONTRACTS,
  createOptimismVoting as createDAOVoting,
  sleep,
} from "../../utils/testing/e2e";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import { scenario } from "../../utils/testing";

let messageTx: TransactionResponse;
let oldGuardian: string;
let newGuardian: string;

scenario("Optimism :: AAVE governance crosschain bridge management", ctxFactory)
  .step("LDO Holder has enought ETH", async ({ l1LDOHolder, gasAmount }) => {
    assert.gte(await l1LDOHolder.getBalance(), gasAmount);
  })

  .step(`Starting DAO vote: Update guardian`, async (ctx) => {
    oldGuardian = await ctx.govBridgeExecutor.getGuardian();
    newGuardian =
      oldGuardian === "0x4e8CC9024Ea3FE886623025fF2aD0CA4bb3D1F42"
        ? "0xD06491e4C8B3107B83dC134894C4c96ED8ddbfa2"
        : "0x4e8CC9024Ea3FE886623025fF2aD0CA4bb3D1F42";

    const updateGuardianCalldata =
      ctx.govBridgeExecutor.interface.encodeFunctionData("updateGuardian", [
        newGuardian,
      ]);
    const updateGuardianData = "0x" + updateGuardianCalldata.substring(10);

    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.govBridgeExecutor.address],
        [0],
        ["updateGuardian(address)"],
        [updateGuardianData],
        [false],
      ]);

    await createDAOVoting(ctx, executorCalldata);
  })

  .step("Enacting Vote", async ({ voting }) => {
    const votesLength = await voting.votesLength();
    const targetVote = votesLength.toNumber() - 1;

    const voteTx = await voting.vote(targetVote, true, true);
    await voteTx.wait();

    while ((await voting.getVotePhase(targetVote)) < 2) {
      await sleep(5000);
    }

    const enactTx = await voting.executeVote(targetVote);
    await enactTx.wait();

    messageTx = enactTx;
  })

  .step(
    "Waiting for status to change to RELAYED",
    async ({ crossChainMessenger }) => {
      await crossChainMessenger.waitForMessageStatus(
        messageTx.hash,
        MessageStatus.RELAYED
      );
    }
  )

  .step("Execute queued task", async ({ govBridgeExecutor, l2Tester }) => {
    const tasksCount = await govBridgeExecutor.getActionsSetCount();

    const targetTask = tasksCount.toNumber() - 1;

    const executionTime = (
      await govBridgeExecutor.getActionsSetById(targetTask)
    ).executionTime.toNumber();
    let chainTime;

    do {
      await sleep(5000);
      const currentBlockNumber = await l2Tester.provider.getBlockNumber();
      const currentBlock = await l2Tester.provider.getBlock(currentBlockNumber);
      chainTime = currentBlock.timestamp;
    } while (chainTime <= executionTime);

    const tx = await govBridgeExecutor.execute(targetTask, {
      gasLimit: 1000000,
    });
    await tx.wait();
  })

  .step("Checking guardian", async ({ govBridgeExecutor }) => {
    assert.equal(await govBridgeExecutor.getGuardian(), newGuardian);
  })

  .run();

async function ctxFactory() {
  const ethOptNetwork = network.multichain(["eth", "opt"], "kovan");

  const [l1Tester, l2Tester] = ethOptNetwork.getSigners(
    env.string("TESTING_PRIVATE_KEY"),
    { forking: false }
  );

  const [l1LDOHolder] = ethOptNetwork.getSigners(
    env.string("TESTING_KOVAN_LDO_HOLDER_PRIVATE_KEY"),
    { forking: false }
  );

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
  };
}
