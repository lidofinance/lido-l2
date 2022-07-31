import env from "../../utils/env";
import network from "../../utils/network";
import lido from "../../utils/lido";
import arbitrum from "../../utils/arbitrum";
import { GovBridgeExecutor__factory } from "../../typechain";
import { assert } from "chai";
import { L1ToL2MessageStatus } from "@arbitrum/sdk";
import prompt from "../../utils/prompt";
import { ethers } from "hardhat";

// Set address of the bridge executor to run the script
const GOV_BRIDGE_EXECUTOR = "";

async function main() {
  const isForking = env.forking();
  const networkName = env.network();
  const ethArbNetwork = network.multichain(["eth", "arb"], networkName);

  const [l1LDOHolder] = ethArbNetwork.getSigners(
    env.string("TESTING_ARB_LDO_HOLDER_PRIVATE_KEY"),
    { forking: isForking }
  );
  const [, arbRunner] = ethArbNetwork.getSigners(env.privateKey(), {
    forking: isForking,
  });

  const govBridgeExecutor = GovBridgeExecutor__factory.connect(
    GOV_BRIDGE_EXECUTOR,
    arbRunner
  );

  const newEthExecutorLidoDAO = lido(networkName, l1LDOHolder);
  const oldEthExecutorLidoDAO = lido(
    networkName === "mainnet" ? "mainnet_test" : networkName,
    l1LDOHolder
  );
  const prevEthGovExecutorAddress =
    await govBridgeExecutor.getEthereumGovernanceExecutor();

  assert.equal(
    oldEthExecutorLidoDAO.agent.address.toLocaleLowerCase(),
    prevEthGovExecutorAddress.toLowerCase(),
    `${oldEthExecutorLidoDAO.agent.address} is not current ethereumGovernanceExecutor`
  );

  console.log(`  · Is forking: ${isForking}`);
  console.log(`  · Network Name: ${networkName}`);
  console.log(
    `  · Prev Ethereum Governance Executor: ${prevEthGovExecutorAddress}`
  );
  console.log(
    `  · New Ethereum Governance Executor: ${newEthExecutorLidoDAO.agent.address}`
  );
  console.log(`  · LDO Holder: ${l1LDOHolder.address}`);
  console.log(`  · LDO Holder ETH balance: ${await l1LDOHolder.getBalance()}`);
  console.log(`  · L2 tx runner: ${arbRunner.address}`);
  console.log(`  · L2 tx runner ETH balance: ${await arbRunner.getBalance()}`);

  await prompt.proceed();

  console.log(`Preparing the voting tx...`);

  const arbAddresses = arbitrum.addresses(networkName);

  // Prepare data for Governance Bridge Executor
  const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
    "queue",
    [
      [GOV_BRIDGE_EXECUTOR],
      [0],
      ["updateEthereumGovernanceExecutor(address)"],
      [
        ethers.utils.defaultAbiCoder.encode(
          ["address"],
          [newEthExecutorLidoDAO.agent.address]
        ),
      ],
      [false],
    ]
  );

  const { callvalue, calldata } = await arbitrum
    .messaging(networkName, { forking: isForking })
    .prepareRetryableTicketTx({
      calldata: executorCalldata,
      recipient: GOV_BRIDGE_EXECUTOR,
      refundAddress: l1LDOHolder.address,
      sender: oldEthExecutorLidoDAO.agent.address,
    });

  const createVoteTx = await oldEthExecutorLidoDAO.createVote(
    l1LDOHolder,
    "Update ethereumGovernanceExecutor on Arbitrum Governance Bridge Executor",
    {
      address: oldEthExecutorLidoDAO.agent.address,
      signature: "execute(address,uint256,bytes)",
      decodedCallData: [arbAddresses.Inbox, callvalue, calldata],
    }
  );

  console.log("Creating voting to update ethereumGovernanceExecutor...");
  await createVoteTx.wait();
  console.log(`Vote was created!`);

  const votesCount = await oldEthExecutorLidoDAO.voting.votesLength();
  const voteId = votesCount.sub(1);

  console.log(`New vote id ${voteId.toString()}`);
  console.log(`Voting for and executing the vote...`);

  const voteAndExecuteTx = await oldEthExecutorLidoDAO.voteAndExecute(
    l1LDOHolder,
    voteId,
    true
  );
  const executeTxReceipt = await voteAndExecuteTx.wait();

  console.log(`Vote ${voteId.toString()} was executed!`);

  console.log("Waiting for L2 transaction...");
  const { status } = await arbitrum
    .messaging(networkName, { forking: isForking })
    .waitForL2Message(executeTxReceipt.transactionHash);

  console.log(`Message delivered to L2`);

  assert.equal(
    status,
    L1ToL2MessageStatus.REDEEMED,
    `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
  );
  console.log("Task was queued on L2!");

  console.log("Executing the queued task...");
  // execute task on L2
  const tasksCount = await govBridgeExecutor.getActionsSetCount();
  const targetTaskId = tasksCount.toNumber() - 1;

  const tx = await govBridgeExecutor.execute(targetTaskId);
  await tx.wait();
  console.log("Task executed on L2!");

  const ethereumGovernanceExecutor =
    await govBridgeExecutor.getEthereumGovernanceExecutor();

  console.log(
    `New ethereum governance executor is: ${ethereumGovernanceExecutor}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
