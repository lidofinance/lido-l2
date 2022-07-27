import { expect } from "chai";
import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  L1ERC20TokenGateway__factory,
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
  GovBridgeExecutor__factory,
  Inbox__factory,
} from "../../typechain";
import env from "../../utils/env";
import network from "../../utils/network";
import { wei } from "../../utils/wei";
import {
  Erc20Bridger,
  getL2Network,
  L1TransactionReceipt,
  L1ToL2MessageStatus,
} from "@arbitrum/sdk";
import { scenario } from "../../utils/testing";
import { L2ERC20Gateway__factory } from "arb-ts";
import { ContractReceipt } from "ethers";

import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  createArbitrumVoting as createDAOVoting,
  sleep,
} from "../../utils/testing/e2e";

let oldGuardian: string;
let newGuardian: string;
let ticketTx: ContractReceipt;

scenario("Arbitrum :: Update guardian", ctxFactory)
  .step("LDO Holder has enought ETH", async ({ l1LDOHolder, gasAmount }) => {
    expect(await l1LDOHolder.getBalance()).to.gte(gasAmount);
  })

  .step("L2 Tester has enought ETH", async ({ l2Tester, gasAmount }) => {
    expect(await l2Tester.getBalance()).to.gte(gasAmount);
  })

  .step(
    "L2 Agent has enought ETH",
    async ({ l1Provider, agent, gasAmount }) => {
      expect(await l1Provider.getBalance(agent.address)).to.gte(gasAmount);
    }
  )

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
    ticketTx = await enactTx.wait();
  })

  .step("Waiting for L2 tx", async ({ l2Tester }) => {
    const l1TxReceipt = new L1TransactionReceipt(ticketTx);
    const message = await l1TxReceipt.getL1ToL2Message(l2Tester);

    const { status } = await message.waitForStatus();
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const response = await message.redeem();
      await response.wait();
    }
  })

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
    expect(await govBridgeExecutor.getGuardian()).to.eq(newGuardian);
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
    l1ERC20TokenGateway: L1ERC20TokenGateway__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1ERC20TokenGateway,
      l1Tester
    ),
    l2ERC20TokenGateway: L2ERC20Gateway__factory.connect(
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
    erc20Bridge: new Erc20Bridger(l2Network),
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
  };
}
