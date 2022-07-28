import {
  Voting__factory,
  Agent__factory,
  TokenManager__factory,
  GovBridgeExecutor__factory,
  Inbox__factory,
  Greeter__factory,
} from "../../typechain";
import { createArbitrumVoting as createDAOVoting } from "../../utils/testing/e2e";
import env from "../../utils/env";
import network from "../../utils/network";
import { scenario } from "../../utils/testing";

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

scenario("Arbitrum :: Warm up", ctxFactory)
  .step(`Starting DAO vote: Greeter`, async (ctx) => {
    const calldata = ctx.greeter.interface.encodeFunctionData("setMessage", [
      "Works !",
    ]);
    const executorCalldata =
      await ctx.govBridgeExecutor.interface.encodeFunctionData("queue", [
        [ctx.greeter.address],
        [0],
        ["setMessage(string)"],
        ["0x" + calldata.substring(10)],
        [false],
      ]);

    await createDAOVoting(ctx, executorCalldata);
  })

  .run();

async function ctxFactory() {
  const ethArbNetwork = network.multichain(["eth", "arb"], "mainnet");

  const [l1LDOHolder, l2LDOHolder] = ethArbNetwork.getSigners(
    env.string("TESTING_RINKEBY_LDO_HOLDER_PRIVATE_KEY"),
    { forking: false }
  );

  return {
    l1LDOHolder,
    inbox: Inbox__factory.connect(CONTRACTS.l1.inbox, l1LDOHolder),
    voting: Voting__factory.connect(CONTRACTS.l1.aragonVoting, l1LDOHolder),
    agent: Agent__factory.connect(CONTRACTS.l1.agent, l1LDOHolder),
    tokenMnanager: TokenManager__factory.connect(
      CONTRACTS.l1.tokenManager,
      l1LDOHolder
    ),
    govBridgeExecutor: GovBridgeExecutor__factory.connect(
      CONTRACTS.l2.govBridgeExecutor,
      l2LDOHolder
    ),
    greeter: Greeter__factory.connect(CONTRACTS.l2.greeter, l1LDOHolder),
  };
}
