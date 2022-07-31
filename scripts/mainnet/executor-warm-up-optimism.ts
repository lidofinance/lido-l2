import {
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
  GovBridgeExecutor__factory,
  Greeter__factory,
} from "../../typechain";
import { createOptimismVoting as createDAOVoting } from "../../utils/testing/e2e";
import env from "../../utils/env";
import network from "../../utils/network";
import optimism from "../../utils/optimism";

const CONTRACTS = {
  l1: {
    tokenManager: "0xdac681011f846af90aebd11d0c9cc6bca70dd636",
    aragonVoting: "0x124208720f804a9ded96f0cd532018614b8ae28d",
    agent: "0x184d39300f2fa4419d04998e9c58cb5de586d879",
    inbox: "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f",
  },
  l2: {
    govBridgeExecutor: "0x1dca41859cd23b526cbe74da8f48ac96e14b1a29",
    greeter: "0x18Ff3bD97739bf910cDCDb8d138976c6afDB4449",
  },
};

async function main() {
  const ethOptNetwork = network.multichain(["eth", "opt"], "mainnet");

  const [, arbProvider] = ethOptNetwork.getProviders({
    forking: env.forking(),
  });

  const [l1LDOHolder] = ethOptNetwork.getSigners(
    env.string("TESTING_ARB_LDO_HOLDER_PRIVATE_KEY"),
    { forking: env.forking() }
  );

  console.log(`Tester: ${l1LDOHolder.address}`);
  console.log(
    `Balance: ${await l1LDOHolder.getBalance().then((b) => b.toString())}`
  );

  const govBridgeExecutor = GovBridgeExecutor__factory.connect(
    CONTRACTS.l2.govBridgeExecutor,
    arbProvider
  );

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

  const optContracts = optimism.contracts("mainnet", { forking: false });

  await createDAOVoting(
    {
      agent,
      voting,
      tokenMnanager,
      govBridgeExecutor,
      l1CrossDomainMessenger: optContracts.L1CrossDomainMessenger,
      l2CrossDomainMessenger: optContracts.L2CrossDomainMessenger,
    },
    executorCalldata
  );

  const votesLength = await voting.votesLength();
  const targetVote = votesLength.toNumber() - 1;
  console.log(`Vote ${targetVote} successfully created!`);

  const voteTx = await voting.vote(targetVote, true, true);
  await voteTx.wait();

  console.log(`Successfully voted 'yay'!`);

  console.log(await voting.getVote(targetVote));

  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
