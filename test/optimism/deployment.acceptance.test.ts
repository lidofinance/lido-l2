import { assert } from "chai";
import {
  ERC20Bridged__factory,
  IERC20Metadata__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { BridgingManagerRole } from "../../utils/bridging-management";
import deployment from "../../utils/deployment";
import env from "../../utils/env";
import network from "../../utils/network";
import { getRoleHolders, scenario } from "../../utils/testing";
import { wei } from "../../utils/wei";

scenario("Optimism Bridge :: deployment acceptance test", ctxFactory)
  .step("L1 Bridge :: proxy admin", async (ctx) => {
    assert.equal(
      await ctx.l1ERC20TokenBridgeProxy.proxy__getAdmin(),
      ctx.deployment.l1.proxyAdmin
    );
  })
  .step("L1 Bridge :: bridge admin", async (ctx) => {
    const currentAdmins = await getRoleHolders(
      ctx.l1ERC20TokenBridge,
      BridgingManagerRole.DEFAULT_ADMIN_ROLE.hash
    );
    assert.equal(currentAdmins.size, 1);
    assert.isTrue(currentAdmins.has(ctx.deployment.l1.bridgeAdmin));

    await assert.isTrue(
      await ctx.l1ERC20TokenBridge.hasRole(
        BridgingManagerRole.DEFAULT_ADMIN_ROLE.hash,
        ctx.deployment.l1.bridgeAdmin
      )
    );
  })
  .step("L1 bridge :: L1 token", async (ctx) => {
    assert.equal(await ctx.l1ERC20TokenBridge.l1Token(), ctx.deployment.token);
  })
  .step("L1 bridge :: L2 token", async (ctx) => {
    assert.equal(
      await ctx.l1ERC20TokenBridge.l2Token(),
      ctx.erc20Bridged.address
    );
  })
  .step("L1 bridge :: L2 token bridge", async (ctx) => {
    assert.equal(
      await ctx.l1ERC20TokenBridge.l2TokenBridge(),
      ctx.l2ERC20TokenBridge.address
    );
  })
  .step("L1 Bridge :: is deposits enabled", async (ctx) => {
    assert.equal(
      await ctx.l1ERC20TokenBridge.isDepositsEnabled(),
      ctx.deployment.l1.depositsEnabled
    );
  })
  .step("L1 Bridge :: is withdrawals enabled", async (ctx) => {
    assert.equal(
      await ctx.l1ERC20TokenBridge.isWithdrawalsEnabled(),
      ctx.deployment.l1.withdrawalsEnabled
    );
  })
  .step("L1 Bridge :: deposits enablers", async (ctx) => {
    const actualDepositsEnablers = await getRoleHolders(
      ctx.l1ERC20TokenBridge,
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash
    );
    const expectedDepositsEnablers = ctx.deployment.l1.depositsEnablers || [];

    assert.equal(actualDepositsEnablers.size, expectedDepositsEnablers.length);
    for (const expectedDepositsEnabler of expectedDepositsEnablers) {
      assert.isTrue(actualDepositsEnablers.has(expectedDepositsEnabler));
    }
  })
  .step("L1 Bridge :: deposits disablers", async (ctx) => {
    const actualDepositsDisablers = await getRoleHolders(
      ctx.l1ERC20TokenBridge,
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash
    );
    const expectedDepositsDisablers = ctx.deployment.l1.depositsDisablers || [];

    assert.equal(
      actualDepositsDisablers.size,
      expectedDepositsDisablers.length
    );
    for (const expectedDepositsDisabler of expectedDepositsDisablers) {
      assert.isTrue(actualDepositsDisablers.has(expectedDepositsDisabler));
    }
  })
  .step("L1 Bridge :: withdrawals enablers", async (ctx) => {
    const actualWithdrawalsEnablers = await getRoleHolders(
      ctx.l1ERC20TokenBridge,
      BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash
    );
    const expectedWithdrawalsEnablers =
      ctx.deployment.l1.withdrawalsEnablers || [];

    assert.equal(
      actualWithdrawalsEnablers.size,
      expectedWithdrawalsEnablers.length
    );
    for (const expectedWithdrawalsEnabler of expectedWithdrawalsEnablers) {
      assert.isTrue(actualWithdrawalsEnablers.has(expectedWithdrawalsEnabler));
    }
  })
  .step("L1 Bridge :: withdrawals disablers", async (ctx) => {
    const actualWithdrawalsDisablers = await getRoleHolders(
      ctx.l1ERC20TokenBridge,
      BridgingManagerRole.WITHDRAWALS_DISABLER_ROLE.hash
    );
    const expectedWithdrawalsDisablers =
      ctx.deployment.l1.withdrawalsDisablers || [];

    assert.equal(
      actualWithdrawalsDisablers.size,
      expectedWithdrawalsDisablers.length
    );
    for (const expectedWithdrawalsDisabler of expectedWithdrawalsDisablers) {
      assert.isTrue(
        actualWithdrawalsDisablers.has(expectedWithdrawalsDisabler)
      );
    }
  })

  .step("L2 Bridge :: proxy admin", async (ctx) => {
    assert.equal(
      await ctx.l2ERC20TokenBridgeProxy.proxy__getAdmin(),
      ctx.deployment.l2.proxyAdmin
    );
  })
  .step("L2 Bridge :: bridge admin", async (ctx) => {
    const currentAdmins = await getRoleHolders(
      ctx.l2ERC20TokenBridge,
      BridgingManagerRole.DEFAULT_ADMIN_ROLE.hash
    );
    assert.equal(currentAdmins.size, 1);
    assert.isTrue(currentAdmins.has(ctx.deployment.l2.bridgeAdmin));

    await assert.isTrue(
      await ctx.l2ERC20TokenBridge.hasRole(
        BridgingManagerRole.DEFAULT_ADMIN_ROLE.hash,
        ctx.deployment.l2.bridgeAdmin
      )
    );
  })
  .step("L2 bridge :: L1 token", async (ctx) => {
    assert.equal(await ctx.l2ERC20TokenBridge.l1Token(), ctx.deployment.token);
  })
  .step("L2 bridge :: L2 token", async (ctx) => {
    assert.equal(
      await ctx.l2ERC20TokenBridge.l2Token(),
      ctx.erc20Bridged.address
    );
  })
  .step("L2 bridge :: L1 token bridge", async (ctx) => {
    assert.equal(
      await ctx.l2ERC20TokenBridge.l1TokenBridge(),
      ctx.l1ERC20TokenBridge.address
    );
  })
  .step("L2 Bridge :: is deposits enabled", async (ctx) => {
    assert.equal(
      await ctx.l2ERC20TokenBridge.isDepositsEnabled(),
      ctx.deployment.l2.depositsEnabled
    );
  })
  .step("L2 Bridge :: is withdrawals enabled", async (ctx) => {
    assert.equal(
      await ctx.l2ERC20TokenBridge.isWithdrawalsEnabled(),
      ctx.deployment.l2.withdrawalsEnabled
    );
  })
  .step("L2 Bridge :: deposits enablers", async (ctx) => {
    const actualDepositsEnablers = await getRoleHolders(
      ctx.l2ERC20TokenBridge,
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash
    );
    const expectedDepositsEnablers = ctx.deployment.l2.depositsEnablers || [];

    assert.equal(actualDepositsEnablers.size, expectedDepositsEnablers.length);
    for (const expectedDepositsEnabler of expectedDepositsEnablers) {
      assert.isTrue(actualDepositsEnablers.has(expectedDepositsEnabler));
    }
  })
  .step("L2 Bridge :: deposits disablers", async (ctx) => {
    const actualDepositsDisablers = await getRoleHolders(
      ctx.l2ERC20TokenBridge,
      BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash
    );
    const expectedDepositsDisablers = ctx.deployment.l2.depositsDisablers || [];

    assert.equal(
      actualDepositsDisablers.size,
      expectedDepositsDisablers.length
    );
    for (const expectedDepositsDisabler of expectedDepositsDisablers) {
      assert.isTrue(actualDepositsDisablers.has(expectedDepositsDisabler));
    }
  })
  .step("L2 Bridge :: withdrawals enablers", async (ctx) => {
    const actualWithdrawalsEnablers = await getRoleHolders(
      ctx.l2ERC20TokenBridge,
      BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash
    );
    const expectedWithdrawalsEnablers =
      ctx.deployment.l2.withdrawalsEnablers || [];

    assert.equal(
      actualWithdrawalsEnablers.size,
      expectedWithdrawalsEnablers.length
    );
    for (const expectedWithdrawalsEnabler of expectedWithdrawalsEnablers) {
      assert.isTrue(actualWithdrawalsEnablers.has(expectedWithdrawalsEnabler));
    }
  })
  .step("L2 Bridge :: withdrawals disablers", async (ctx) => {
    const actualWithdrawalsDisablers = await getRoleHolders(
      ctx.l2ERC20TokenBridge,
      BridgingManagerRole.WITHDRAWALS_DISABLER_ROLE.hash
    );
    const expectedWithdrawalsDisablers =
      ctx.deployment.l2.withdrawalsDisablers || [];

    assert.equal(
      actualWithdrawalsDisablers.size,
      expectedWithdrawalsDisablers.length
    );
    for (const expectedWithdrawalsDisabler of expectedWithdrawalsDisablers) {
      assert.isTrue(
        actualWithdrawalsDisablers.has(expectedWithdrawalsDisabler)
      );
    }
  })

  .step("L2 Token :: proxy admin", async (ctx) => {
    assert.equal(
      await ctx.erc20BridgedProxy.proxy__getAdmin(),
      ctx.deployment.l1.proxyAdmin
    );
  })
  .step("L2 Token :: name", async (ctx) => {
    assert.equal(await ctx.erc20Bridged.name(), ctx.l2TokenInfo.name);
  })
  .step("L2 Token :: symbol", async (ctx) => {
    assert.equal(await ctx.erc20Bridged.symbol(), ctx.l2TokenInfo.symbol);
  })
  .step("L2 Token :: decimals", async (ctx) => {
    assert.equal(await ctx.erc20Bridged.decimals(), ctx.l2TokenInfo.decimals);
  })
  .step("L2 Token :: total supply", async (ctx) => {
    assert.equalBN(await ctx.erc20Bridged.totalSupply(), wei`0`);
  })
  .step("L2 token :: bridge", async (ctx) => {
    assert.equalBN(
      await ctx.erc20Bridged.bridge(),
      ctx.l2ERC20TokenBridge.address
    );
  })

  .run();

async function ctxFactory() {
  const networkConfig = network.getMultichainNetwork("optimism");
  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const l1ERC20TokenBridge = env.address("L1_ERC20_TOKEN_BRIDGE");
  const l2ERC20TokenBridge = env.address("L2_ERC20_TOKEN_BRIDGE");
  const erc20Bridged = env.address("ERC20_BRIDGED");
  const l1Token = IERC20Metadata__factory.connect(
    deploymentConfig.token,
    networkConfig.l1.provider
  );
  const [name, symbol, decimals] = await Promise.all([
    l1Token.name(),
    l1Token.symbol(),
    l1Token.decimals(),
  ]);

  return {
    network: networkConfig,
    deployment: deploymentConfig,
    l2TokenInfo: {
      name,
      symbol,
      decimals,
    },
    l1ERC20TokenBridge: L1ERC20TokenBridge__factory.connect(
      l1ERC20TokenBridge,
      networkConfig.l1.provider
    ),
    l1ERC20TokenBridgeProxy: OssifiableProxy__factory.connect(
      l1ERC20TokenBridge,
      networkConfig.l1.provider
    ),
    l2ERC20TokenBridge: L2ERC20TokenBridge__factory.connect(
      l2ERC20TokenBridge,
      networkConfig.l2.provider
    ),
    l2ERC20TokenBridgeProxy: OssifiableProxy__factory.connect(
      l2ERC20TokenBridge,
      networkConfig.l2.provider
    ),
    erc20Bridged: ERC20Bridged__factory.connect(
      erc20Bridged,
      networkConfig.l2.provider
    ),
    erc20BridgedProxy: OssifiableProxy__factory.connect(
      erc20Bridged,
      networkConfig.l2.provider
    ),
  };
}
