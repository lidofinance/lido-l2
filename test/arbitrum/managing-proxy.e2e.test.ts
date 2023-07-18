import { L1ToL2MessageStatus, L1TransactionReceipt } from "@arbitrum/sdk";
import { assert } from "chai";
import { ContractReceipt } from "ethers";

import {
  ERC20Bridged__factory,
  L2ERC20TokenGateway__factory,
  GovBridgeExecutor__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  E2E_TEST_CONTRACTS_ARBITRUM as E2E_TEST_CONTRACTS,
  sleep,
} from "../../utils/testing/e2e";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import { scenario } from "../../utils/testing";
import arbitrum from "../../utils/arbitrum";
import lido from "../../utils/lido";

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
    async ({ l1Provider, lidoAragonDAO, gasAmount }) => {
      assert.gte(
        await l1Provider.getBalance(lidoAragonDAO.agent.address),
        gasAmount
      );
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

  .step(
    "Proxy upgrade: Enacting Voting",
    async ({ l1LDOHolder, lidoAragonDAO }) => {
      const votesLength = await lidoAragonDAO.voting.votesLength();

      const tx = await lidoAragonDAO.voteAndExecute(
        l1LDOHolder,
        votesLength.toNumber() - 1
      );

      upgradeMessageResponse = await tx.wait();
    }
  )

  .step("Proxy upgrade: Waiting for L2 tx", async ({ messaging, l2Tester }) => {
    const { status } = await messaging.waitForL2Message(
      upgradeMessageResponse.transactionHash
    );

    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      console.warn(
        `Auto redeem for tx ${upgradeMessageResponse.transactionHash} failed. Redeeming it manually...`
      );
      const l1TxReceipt = new L1TransactionReceipt(upgradeMessageResponse);
      const [message] = await l1TxReceipt.getL1ToL2Messages(l2Tester);
      const redeemResponse = await message.redeem({ gasLimit: 300_000 });
      await redeemResponse.wait();
      console.log("Tx was redeemed");
    } else if (status === L1ToL2MessageStatus.REDEEMED) {
      console.log("Tx was auto redeemed");
    } else {
      assert.isTrue(
        false,
        `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
      );
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

  .step(
    "Proxy ossify: Enacting Voting",
    async ({ lidoAragonDAO, l1LDOHolder }) => {
      const votesLength = await lidoAragonDAO.voting.votesLength();

      const tx = await lidoAragonDAO.voteAndExecute(
        l1LDOHolder,
        votesLength.toNumber() - 1
      );

      ossifyMessageResponse = await tx.wait();
    }
  )

  .step("Proxy ossify: Waiting for L2 tx", async ({ messaging }) => {
    const { status } = await messaging.waitForL2Message(
      ossifyMessageResponse.transactionHash
    );

    assert.equal(
      status,
      L1ToL2MessageStatus.REDEEMED,
      `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
    );
  })

  .step("Proxy ossify: execute", async ({ govBridgeExecutor }) => {
    const taskId =
      (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1;
    const executeTx = await govBridgeExecutor.execute(taskId, {
      gasLimit: 2000000,
    });
    await executeTx.wait();
  })

  .step("Proxy upgrade: check state", async ({ proxyToOssify }) => {
    const isOssifiedAfter = await proxyToOssify.proxy__getIsOssified();

    assert.isTrue(isOssifiedAfter);
  })

  .run();

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
    l1LDOHolder,
    l1Provider,

    l2Token: ERC20Bridged__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2Token,
      l2Tester
    ),
    l2ERC20TokenGateway: L2ERC20TokenGateway__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      l2Tester
    ),
    govBridgeExecutor: GovBridgeExecutor__factory.connect(
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      l2Tester
    ),
    proxyToOssify: await new OssifiableProxy__factory(l2Tester).deploy(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      "0x"
    ),
  };
}
