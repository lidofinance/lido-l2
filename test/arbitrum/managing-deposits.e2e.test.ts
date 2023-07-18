import { L1ToL2MessageStatus } from "@arbitrum/sdk";
import { assert } from "chai";
import { ContractReceipt } from "ethers";

import {
  L2ERC20TokenGateway__factory,
  GovBridgeExecutor__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  sleep,
} from "../../utils/testing/e2e";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import env from "../../utils/env";
import { scenario } from "../../utils/testing";
import arbitrum from "../../utils/arbitrum";
import lido from "../../utils/lido";

const DEPOSIT_ENABLER_ROLE =
  "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a";
const DEPOSIT_DISABLER_ROLE =
  "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6";

let l2DepositsInitialState: boolean;
let ticketTx: ContractReceipt;

const scenarioTest = scenario(
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
    async ({ l1Provider, lidoAragonDAO, gasAmount }) => {
      assert.gte(
        await l1Provider.getBalance(lidoAragonDAO.agent.address),
        gasAmount
      );
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

    const arbAddresses = arbitrum.addresses("goerli");

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

  .step("Enacting Vote", async ({ l1LDOHolder, lidoAragonDAO }) => {
    const votesLength = await lidoAragonDAO.voting.votesLength();

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

  .step("Checking deposits state", async ({ l2ERC20TokenGateway }) => {
    assert.equal(
      await l2ERC20TokenGateway.isDepositsEnabled(),
      !l2DepositsInitialState
    );
  });

// make first run to change state from enabled/disabled -> disabled/enabled
scenarioTest.run();

// make another run to return the state to the initial and test vice versa actions
scenarioTest.run();

async function ctxFactory() {
  const ethArbNetwork = network.multichain(["eth", "arb"], "goerli");

  const [l1Provider] = ethArbNetwork.getProviders({
    forking: false,
  });
  const [, l2Tester] = ethArbNetwork.getSigners(
    env.string("TESTING_PRIVATE_KEY"),
    { forking: false }
  );

  const [l1LDOHolder] = ethArbNetwork.getSigners(
    env.string("TESTING_ARB_LDO_HOLDER_PRIVATE_KEY"),
    { forking: false }
  );

  return {
    lidoAragonDAO: lido("goerli", l1Provider),
    messaging: arbitrum.messaging("goerli", { forking: false }),
    gasAmount: wei`0.1 ether`,
    l2Tester,
    l1Provider,
    l1LDOHolder,
    l2ERC20TokenGateway: L2ERC20TokenGateway__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      l2Tester
    ),
    govBridgeExecutor: GovBridgeExecutor__factory.connect(
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      l2Tester
    ),
  };
}
