import { assert } from "chai";
import { ContractReceipt } from "ethers";
import { L2ERC20Gateway__factory } from "arb-ts";
import { Erc20Bridger, getL2Network, L1ToL2MessageStatus } from "@arbitrum/sdk";

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
import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  sleep,
} from "../../utils/testing/e2e";
import env from "../../utils/env";
import network from "../../utils/network";
import { wei } from "../../utils/wei";
import { scenario } from "../../utils/testing";
import aragon from "../../utils/aragon";
import arbitrum from "../../utils/arbitrum";

let oldGuardian: string;
let newGuardian: string;
let ticketTx: ContractReceipt;

scenario("Arbitrum :: Update guardian", ctxFactory)
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

    const arbAddresses = arbitrum.addresses("rinkeby");

    const { calldata, callvalue } =
      await ctx.messaging.prepareRetryableTicketTx({
        sender: ctx.lidoAragonDAO.agent.address,
        recipient: ctx.govBridgeExecutor.address,
        calldata: executorCalldata,
        refundAddress: ctx.l2Tester.address,
      });

    const tx = await ctx.lidoAragonDAO.createVote(
      ctx.l1LDOHolder,
      "E2E Test Voting",
      {
        address: ctx.lidoAragonDAO.agent.address,
        signature: "execute(address,uint256,bytes)",
        decodedCallData: [arbAddresses.Inbox, callvalue, calldata],
      }
    );

    await tx.wait();
  })

  .step("Enacting Vote", async ({ l1LDOHolder, voting, lidoAragonDAO }) => {
    const votesLength = await voting.votesLength();

    const tx = await lidoAragonDAO.voteAndExecute(
      l1LDOHolder,
      votesLength.toNumber() - 1
    );

    ticketTx = await tx.wait();
  })

  .step("Waiting for L2 tx", async ({ messaging }) => {
    const { status } = await messaging.waitForL2Message(
      ticketTx.transactionHash
    );

    assert.equal(
      status,
      L1ToL2MessageStatus.REDEEMED,
      `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
    );
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
    assert.equal(await govBridgeExecutor.getGuardian(), newGuardian);
  })
  .run();

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

  const lidoAragonDAO = aragon(
    {
      agent: "0x12869c3349f993c5c20bab9482b7d16aff0ae2f9",
      voting: "0x04F9590D3EEC8e619D7714ffeF664aD3fd53b880",
      tokenManager: "0x1ee7e87486f9ae6e27a5e58310a5319394360cf0",
    },
    l1Provider
  );

  return {
    messaging: arbitrum.messaging("rinkeby", { forking: false }),
    lidoAragonDAO,
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
