import { assert } from "chai";
import { ethers } from "hardhat";
import { GovBridgeExecutor__factory } from "../../typechain";
import env from "../../utils/env";
import lido from "../../utils/lido";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import prompt from "../../utils/prompt";

// Set address of the bridge executor to run the script
const GOV_BRIDGE_EXECUTOR = "";

async function main() {
  const isForking = env.forking();
  const networkName = env.network();
  const ethLiskNetwork = network.multichain(["eth", "lisk"], networkName);

  const [l1LDOHolder] = ethLiskNetwork.getSigners(
    env.string("TESTING_OPT_LDO_HOLDER_PRIVATE_KEY"),
    { forking: isForking }
  );
  const [, liskRunner] = ethLiskNetwork.getSigners(env.privateKey(), {
    forking: isForking,
  });

  const govBridgeExecutor = GovBridgeExecutor__factory.connect(
    GOV_BRIDGE_EXECUTOR,
    liskRunner
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
  console.log(`  · L2 tx runner: ${liskRunner.address}`);
  console.log(`  · L2 tx runner ETH balance: ${await liskRunner.getBalance()}`);

  await prompt.proceed();

  console.log(`Preparing the voting tx...`);

  const optAddresses = optimism.addresses(networkName);

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

  const { callvalue, calldata } = await optimism
    .messaging(networkName, { forking: isForking })
    .prepareL2Message({
      calldata: executorCalldata,
      recipient: GOV_BRIDGE_EXECUTOR,
      sender: oldEthExecutorLidoDAO.agent.address,
    });

  const createVoteTx = await oldEthExecutorLidoDAO.createVote(
    l1LDOHolder,
    "Update ethereumGovernanceExecutor on Optimism Governance Bridge Executor",
    {
      address: oldEthExecutorLidoDAO.agent.address,
      signature: "execute(address,uint256,bytes)",
      decodedCallData: [
        optAddresses.L1CrossDomainMessenger,
        callvalue,
        calldata,
      ],
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

  console.log(`Waiting for L2 transaction...`);
  await optimism
    .messaging(networkName, { forking: isForking })
    .waitForL2Message(executeTxReceipt.transactionHash);

  console.log(`Message delivered to L2`);

  console.log("Executing the queued task...");
  // execute task on L2
  const tasksCount = await govBridgeExecutor.getActionsSetCount();
  const targetTaskId = tasksCount.toNumber() - 1;

  const tx = await govBridgeExecutor.execute(targetTaskId);
  await tx.wait();
  console.log(`Task executed on L2!`);

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
