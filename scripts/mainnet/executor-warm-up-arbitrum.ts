import {
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
  GovBridgeExecutor__factory,
  Inbox__factory,
  Greeter__factory,
} from "../../typechain";
import { L1TransactionReceipt, L1ToL2MessageStatus } from "@arbitrum/sdk";
import { createArbitrumVoting as createDAOVoting } from "../../utils/testing/e2e";
import env from "../../utils/env";
import network from "../../utils/network";
import { L1ToL2MessageGasEstimator } from "@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator";
import { ethers } from "hardhat";
import { hexDataLength } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { wei } from "../../utils/wei";

const CONTRACTS = {
  l1: {
    tokenManager: "0xdac681011f846af90aebd11d0c9cc6bca70dd636",
    aragonVoting: "0x124208720f804a9ded96f0cd532018614b8ae28d",
    agent: "0x184d39300f2fa4419d04998e9c58cb5de586d879",
    inbox: "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f",
  },
  l2: {
    govBridgeExecutor: "0xAf2F4F94F06F8f9c6FCA5547fDd5Da723e4aE803",
    greeter: "0x1763b9ED3586B08AE796c7787811a2E1bc16163a",
  },
};

async function main() {
  const ethArbNetwork = network.multichain(["eth", "arb"], "mainnet");

  const [ethProvider, arbProvider] = ethArbNetwork.getProviders({
    forking: false,
  });
  const [, arbRunner] = ethArbNetwork.getSigners(env.privateKey(), {
    forking: false,
  });

  const [l1LDOHolder, l2LDOHolder] = ethArbNetwork.getSigners(
    env.string("TESTING_ARB_LDO_HOLDER_PRIVATE_KEY"),
    { forking: false }
  );

  const govBridgeExecutor = GovBridgeExecutor__factory.connect(
    CONTRACTS.l2.govBridgeExecutor,
    arbProvider
  );

  const inbox = Inbox__factory.connect(CONTRACTS.l1.inbox, l1LDOHolder);
  const voting = Voting__factory.connect(
    CONTRACTS.l1.aragonVoting,
    l1LDOHolder
  );
  const agent = Agent__factory.connect(CONTRACTS.l1.agent, l1LDOHolder);
  const tokenMnanager = TokenManager__factory.connect(
    CONTRACTS.l1.tokenManager,
    l1LDOHolder
  );

  const greeter = Greeter__factory.connect(CONTRACTS.l2.greeter, arbProvider);

  const calldata = greeter.interface.encodeFunctionData("setMessage", [
    "Works !",
  ]);

  const l1ToL2MessageGasEstimator = new L1ToL2MessageGasEstimator(arbProvider);

  const submissionPriceWeiExact =
    await l1ToL2MessageGasEstimator.estimateSubmissionFee(
      ethProvider,
      await ethProvider.getGasPrice(),
      hexDataLength(calldata)
    );

  console.log(calldata);
  console.log(
    `Current retryable base submission price: ${submissionPriceWeiExact.toString()}`
  );
  const submissionPriceWeiWithExtra = submissionPriceWeiExact.mul(5);

  const gasPriceBid = await arbProvider.getGasPrice();
  console.log(`L2 gas price: ${gasPriceBid.toString()}`);

  const maxGas =
    await l1ToL2MessageGasEstimator.estimateRetryableTicketGasLimit(
      govBridgeExecutor.address,
      greeter.address,
      BigNumber.from(0),
      arbRunner.address,
      arbRunner.address,
      calldata,
      ethers.utils.parseEther("1"),
      submissionPriceWeiWithExtra,
      wei.toBigNumber(wei`1_000_000 wei`),
      gasPriceBid
    );

  console.log(`Max gas: ${maxGas.toString()}`);

  const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
    "queue",
    [
      [greeter.address],
      [0],
      ["setMessage(string)"],
      ["0x" + calldata.substring(10)],
      [false],
    ]
  );

  const callValue = submissionPriceWeiWithExtra.add(gasPriceBid.mul(maxGas));
  console.log(
    `Sending greeting to L2 with ${callValue.toString()} callValue for L2 fees:`
  );
  await createDAOVoting(
    {
      l1Tester: l1LDOHolder,
      l2Tester: l2LDOHolder,
      govBridgeExecutor,
      inbox,
      agent,
      tokenMnanager,
      voting,
    },
    executorCalldata,
    {
      maxGas,
      gasPriceBid,
      maxSubmissionCost: submissionPriceWeiWithExtra,
      callValue,
    }
  );
  const votesLength = await voting.votesLength();
  const targetVote = votesLength.toNumber() - 1;
  console.log(`Vote ${targetVote} successfully created!`);

  const voteTx = await voting.vote(targetVote, true, true);
  const ticketTx = await voteTx.wait();

  console.log(`Successfully voted 'yay'!`);

  const l1TxReceipt = new L1TransactionReceipt(ticketTx);
  const message = await l1TxReceipt.getL1ToL2Message(l2LDOHolder);

  const { status } = await message.waitForStatus();
  if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
    const response = await message.redeem();
    await response.wait();
  }

  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
