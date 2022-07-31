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
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  GovBridgeExecutor__factory,
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  createArbitrumVoting as createDAOVoting,
  sleep,
} from "../../utils/testing/e2e";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import env from "../../utils/env";
import { scenario } from "../../utils/testing";

const DEPOSIT_ENABLER_ROLE =
  "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a";
const DEPOSIT_DISABLER_ROLE =
  "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6";

let l2DepositsInitialState: boolean;
let ticketTx: ContractReceipt;

scenario(
  "Arbitrum :: AAVE governance crosschain bridge: token bridge management",
  ctxFactory
)
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

  .step("Checking deposits status", async ({ l2ERC20TokenGateway }) => {
    l2DepositsInitialState = await l2ERC20TokenGateway.isDepositsEnabled();
  })

  .step(`Starting DAO vote`, async (ctx) => {
    const grantRoleCalldata =
      ctx.l2ERC20TokenGateway.interface.encodeFunctionData("grantRole", [
        l2DepositsInitialState ? DEPOSIT_DISABLER_ROLE : DEPOSIT_ENABLER_ROLE,
        ctx.govBridgeExecutor.address,
      ]);
    const grantRoleData = "0x" + grantRoleCalldata.substring(10);

    const actionCalldata = l2DepositsInitialState
      ? ctx.l2ERC20TokenGateway.interface.encodeFunctionData("disableDeposits")
      : ctx.l2ERC20TokenGateway.interface.encodeFunctionData("enableDeposits");

    const actionData = "0x" + actionCalldata.substring(10);

    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.l2ERC20TokenGateway.address, ctx.l2ERC20TokenGateway.address],
        [0, 0],
        [
          "grantRole(bytes32,address)",
          l2DepositsInitialState ? "disableDeposits()" : "enableDeposits()",
        ],
        [grantRoleData, actionData],
        [false, false],
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

  .step("Checking deposits state", async ({ l2ERC20TokenGateway }) => {
    assert.equal(
      await l2ERC20TokenGateway.isDepositsEnabled(),
      !l2DepositsInitialState
    );
  })

  .run(2);

async function ctxFactory() {
  const ethArbNetwork = network.multichain(["eth", "arb"], "rinkeby");

  const [l1Provider, l2Provider] = ethArbNetwork.getProviders({
    forking: false,
  });
  const [l1Tester, l2Tester] = ethArbNetwork.getSigners(
    env.string("TESTING_PRIVATE_KEY"),
    { forking: false }
  );

  const [l1LDOHolder] = ethArbNetwork.getSigners(
    env.string("TESTING_ARB_LDO_HOLDER_PRIVATE_KEY"),
    { forking: false }
  );

  const l2Network = await getL2Network(l2Provider);

  // replace gateway router addresses with test
  l2Network.tokenBridge.l1GatewayRouter = E2E_TEST_CONTRACTS.l1.l1GatewayRouter;
  l2Network.tokenBridge.l2GatewayRouter = E2E_TEST_CONTRACTS.l2.l2GatewayRouter;
  return {
    gasAmount: wei`0.1 ether`,
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
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
  };
}
