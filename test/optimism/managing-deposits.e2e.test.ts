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

const DEPOSIT_ENABLER_ROLE =
  "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a";
const DEPOSIT_DISABLER_ROLE =
  "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6";

let l2DepositsInitialState = true;

let messageTx: TransactionResponse;

scenario(
  "Optimism :: AAVE governance crosschain bridge: token bridge management",
  ctxFactory
)
  .step("LDO Holder has enought ETH", async ({ l1LDOHolder, gasAmount }) => {
    assert.gte(await l1LDOHolder.getBalance(), gasAmount);
  })

  .step("Checking deposits status", async ({ l2ERC20TokenBridge }) => {
    l2DepositsInitialState = await l2ERC20TokenBridge.isDepositsEnabled();
  })

  .step(`Starting DAO vote`, async (ctx) => {
    const grantRoleCalldata =
      ctx.l2ERC20TokenBridge.interface.encodeFunctionData("grantRole", [
        l2DepositsInitialState ? DEPOSIT_DISABLER_ROLE : DEPOSIT_ENABLER_ROLE,
        ctx.govBridgeExecutor.address,
      ]);
    const grantRoleData = "0x" + grantRoleCalldata.substring(10);

    const actionCalldata = l2DepositsInitialState
      ? ctx.l2ERC20TokenBridge.interface.encodeFunctionData("disableDeposits")
      : ctx.l2ERC20TokenBridge.interface.encodeFunctionData("enableDeposits");

    const actionData = "0x" + actionCalldata.substring(10);

    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.l2ERC20TokenBridge.address, ctx.l2ERC20TokenBridge.address],
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

    while ((await voting.getVotePhase(targetVote)) !== 2) {
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

  .step("Checking deposits state", async ({ l2ERC20TokenBridge }) => {
    assert.equal(
      await l2ERC20TokenBridge.isDepositsEnabled(),
      !l2DepositsInitialState
    );
  })

  .run(2);

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
  };
}
