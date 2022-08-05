import { assert } from "chai";

import env from "../../utils/env";
import arbitrum from "../../utils/arbitrum";
import { L1ERC20TokenBridge__factory } from "../../typechain";
import { wei } from "../../utils/wei";
import testing, { scenario } from "../../utils/testing";
import { BridgingManagerRole } from "../../utils/bridging-management";

scenario("Arbitrum :: Launch integration test", ctx)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Enable deposits", async (ctx) => {
    const { l1ERC20TokenGateway } = ctx;
    assert.isFalse(await l1ERC20TokenGateway.isDepositsEnabled());

    await l1ERC20TokenGateway.enableDeposits();
    assert.isTrue(await l1ERC20TokenGateway.isDepositsEnabled());
  })

  .step("Renounce role", async (ctx) => {
    const { l1ERC20TokenGateway, l1DevMultisig } = ctx;
    assert.isTrue(
      await l1ERC20TokenGateway.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        await l1DevMultisig.getAddress()
      )
    );

    await l1ERC20TokenGateway.renounceRole(
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
      await l1DevMultisig.getAddress()
    );
    assert.isFalse(
      await l1ERC20TokenGateway.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        await l1DevMultisig.getAddress()
      )
    );
  })

  .run();

async function ctx() {
  const networkName = env.network("TESTING_ARB_NETWORK", "mainnet");
  const { l1Provider, l2Provider, l1ERC20TokenGateway, l1DevMultisig } =
    await arbitrum.testing(networkName).getIntegrationTestSetup();

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  const l1Sender = testing.accounts.sender(l1Provider);

  await l1Sender.sendTransaction({
    value: wei`1 ether`,
    to: await l1DevMultisig.getAddress(),
  });

  const l1ERC20TokenGatewayImpl = L1ERC20TokenBridge__factory.connect(
    l1ERC20TokenGateway.address,
    l1DevMultisig
  );

  return {
    l1Provider,
    l2Provider,
    l1DevMultisig,
    l1ERC20TokenGateway: l1ERC20TokenGatewayImpl,
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}
