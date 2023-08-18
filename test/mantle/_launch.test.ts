import { assert } from "chai";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import mantle from "../../utils/mantle";
import testing, { scenario } from "../../utils/testing";
import { BridgingManagerRole } from "../../utils/bridging-management";
import { L1ERC20TokenBridge__factory } from "../../typechain";

const REVERT = env.bool("REVERT", true);

scenario("Mantle :: Launch integration test", ctxFactory)
  .after(async (ctx) => {
    if (REVERT) {
      await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
      await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
    } else {
      console.warn(
        "Revert is skipped! Forked node restart might be required for repeated launches!"
      );
    }
  })

  .step("Enable deposits", async (ctx) => {
    const { l1ERC20TokenBridge } = ctx;
    assert.isFalse(await l1ERC20TokenBridge.isDepositsEnabled());

    await l1ERC20TokenBridge.enableDeposits();
    assert.isTrue(await l1ERC20TokenBridge.isDepositsEnabled());
  })

  .step("Renounce role", async (ctx) => {
    const { l1ERC20TokenBridge, l1DevMultisig } = ctx;
    assert.isTrue(
      await l1ERC20TokenBridge.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        await l1DevMultisig.getAddress()
      )
    );

    await l1ERC20TokenBridge.renounceRole(
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
      await l1DevMultisig.getAddress()
    );
    assert.isFalse(
      await l1ERC20TokenBridge.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        await l1DevMultisig.getAddress()
      )
    );
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_MNT_NETWORK", "mainnet");

  const { l1Provider, l2Provider, l1ERC20TokenBridge } = await mantle
    .testing(networkName)
    .getIntegrationTestSetup();

  const hasDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);
  const l1DevMultisig = hasDeployedContracts
    ? await testing.impersonate(testing.env.L1_DEV_MULTISIG(), l1Provider)
    : testing.accounts.deployer(l1Provider);

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  await testing.setBalance(
    await l1DevMultisig.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  const l1ERC20TokenBridgeImpl = L1ERC20TokenBridge__factory.connect(
    l1ERC20TokenBridge.address,
    l1DevMultisig
  );

  return {
    l1Provider,
    l2Provider,
    l1DevMultisig,
    l1ERC20TokenBridge: l1ERC20TokenBridgeImpl,
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}
