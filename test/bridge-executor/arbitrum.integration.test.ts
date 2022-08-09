import { assert } from "chai";
import testing, { scenario } from "../../utils/testing";
import {
  ERC20BridgedStub__factory,
  L2ERC20TokenGateway__factory,
  ArbitrumBridgeExecutor__factory,
  ERC20Bridged__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import { getBridgeExecutorParams } from "../../utils/bridge-executor";
import { BridgingManagerRole } from "../../utils/bridging-management";

import arbitrum from "../../utils/arbitrum";
import network from "../../utils/network";
import env from "../../utils/env";

scenario("Arbitrum :: Bridge Executor integration test", ctx)
  .before(async (ctx) => {
    ctx.snapshot.l2 = await ctx.l2.provider.send("evm_snapshot", []);
  })

  .after(async (ctx) => {
    await ctx.l2.provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate Bridging", async (ctx) => {
    const {
      l2: { bridgeExecutor, l2ERC20TokenGateway },
    } = ctx;

    assert.isFalse(
      await l2ERC20TokenGateway.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isFalse(
      await l2ERC20TokenGateway.hasRole(
        BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isFalse(await l2ERC20TokenGateway.isDepositsEnabled());
    assert.isFalse(await l2ERC20TokenGateway.isWithdrawalsEnabled());

    const actionsSetCountBefore = await bridgeExecutor.getActionsSetCount();
    await bridgeExecutor.queue(
      new Array(4).fill(l2ERC20TokenGateway.address),
      new Array(4).fill(0),
      [
        "grantRole(bytes32,address)",
        "grantRole(bytes32,address)",
        "enableDeposits()",
        "enableWithdrawals()",
      ],
      [
        "0x" +
          l2ERC20TokenGateway.interface
            .encodeFunctionData("grantRole", [
              BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
              bridgeExecutor.address,
            ])
            .substring(10),
        "0x" +
          l2ERC20TokenGateway.interface
            .encodeFunctionData("grantRole", [
              BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash,
              bridgeExecutor.address,
            ])
            .substring(10),
        "0x" +
          l2ERC20TokenGateway.interface
            .encodeFunctionData("enableDeposits")
            .substring(10),
        "0x" +
          l2ERC20TokenGateway.interface
            .encodeFunctionData("enableWithdrawals")
            .substring(10),
      ],
      new Array(4).fill(false)
    );

    const actionsSetCountAfter = await bridgeExecutor.getActionsSetCount();

    assert.equalBN(actionsSetCountBefore.add(1), actionsSetCountAfter);
    // execute the last added actions set
    await bridgeExecutor.execute(actionsSetCountAfter.sub(1), { value: 0 });

    assert.isTrue(
      await l2ERC20TokenGateway.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isTrue(
      await l2ERC20TokenGateway.hasRole(
        BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isTrue(await l2ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isWithdrawalsEnabled());
  })
  .step("Change Proxy implementation", async (ctx) => {
    const {
      l2: { l2Token, bridgeExecutor, l2ERC20TokenGatewayProxy },
    } = ctx;

    const actionsSetCountBefore = await bridgeExecutor.getActionsSetCount();

    const proxyImplBefore =
      await l2ERC20TokenGatewayProxy.proxy__getImplementation();

    await bridgeExecutor.queue(
      [l2ERC20TokenGatewayProxy.address],
      [0],
      ["proxy__upgradeTo(address)"],
      [
        "0x" +
          l2ERC20TokenGatewayProxy.interface
            .encodeFunctionData("proxy__upgradeTo", [l2Token.address])
            .substring(10),
      ],
      [false]
    );

    const actionSetCount = await bridgeExecutor.getActionsSetCount();

    assert.equalBN(actionsSetCountBefore.add(1), actionSetCount);

    await bridgeExecutor.execute(actionsSetCountBefore, { value: 0 });
    const proxyImplAfter =
      await l2ERC20TokenGatewayProxy.proxy__getImplementation();

    assert.notEqual(proxyImplBefore, proxyImplAfter);
    assert.equal(proxyImplAfter, l2Token.address);
  })
  .step("Change proxy Admin", async (ctx) => {
    const {
      l2: {
        l2ERC20TokenGatewayProxy,
        bridgeExecutor,
        accounts: { deployer },
      },
    } = ctx;
    const proxyAdminBefore = await l2ERC20TokenGatewayProxy.proxy__getAdmin();

    const actionsSetCountBefore = await bridgeExecutor.getActionsSetCount();

    await bridgeExecutor.queue(
      [l2ERC20TokenGatewayProxy.address],
      [0],
      ["proxy__changeAdmin(address)"],
      [
        "0x" +
          l2ERC20TokenGatewayProxy.interface
            .encodeFunctionData("proxy__changeAdmin", [deployer.address])
            .substring(10),
      ],
      [false]
    );

    const actionSetCount = await bridgeExecutor.getActionsSetCount();
    assert.equalBN(actionsSetCountBefore.add(1), actionSetCount);

    await bridgeExecutor.execute(actionsSetCountBefore, { value: 0 });
    const proxyAdminAfter = await l2ERC20TokenGatewayProxy.proxy__getAdmin();

    assert.notEqual(proxyAdminBefore, proxyAdminAfter);
    assert.equal(proxyAdminAfter, deployer.address);
  })

  .run();

async function ctx() {
  const networkName = env.network("TESTING_ARB_NETWORK", "mainnet");
  const [l1Provider, l2Provider] = network
    .multichain(["eth", "arb"], networkName)
    .getProviders({ forking: true });

  const testingOnDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);

  const l1Deployer = testing.accounts.deployer(l1Provider);
  const l2Deployer = testing.accounts.deployer(l2Provider);

  await arbitrum.testing(networkName).stubArbSysContract();

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );
  const govBridgeExecutor = testingOnDeployedContracts
    ? ArbitrumBridgeExecutor__factory.connect(
        testing.env.ARB_GOV_BRIDGE_EXECUTOR(),
        l2Provider
      )
    : await new ArbitrumBridgeExecutor__factory(l2Deployer).deploy(
        l1Deployer.address,
        ...getBridgeExecutorParams(),
        l2Deployer.address
      );

  const l1EthGovExecutorAddress =
    await govBridgeExecutor.getEthereumGovernanceExecutor();

  const [, l2DeployScript] = await arbitrum
    .deployment(networkName)
    .erc20TokenGatewayDeployScript(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: {
          proxy: govBridgeExecutor.address,
          bridge: govBridgeExecutor.address,
        },
      }
    );

  await l2DeployScript.run();

  const l2Token = ERC20Bridged__factory.connect(
    l2DeployScript.getContractAddress(1),
    l2Deployer
  );
  const l2ERC20TokenGateway = L2ERC20TokenGateway__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );
  const l2ERC20TokenGatewayProxy = OssifiableProxy__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );
  const l1ExecutorAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(l1EthGovExecutorAddress),
    l2Provider
  );
  await l2Deployer.sendTransaction({
    to: await l1ExecutorAliased.getAddress(),
    value: wei`1 ether`,
  });

  if (testingOnDeployedContracts) {
    console.log("Testing on deployed contracts");
    console.log(`  Network name: ${networkName}`);
    console.log(`  Gov Bridge Executor Address: ${govBridgeExecutor.address}`);
  }

  return {
    l2: {
      l2Token,
      bridgeExecutor: govBridgeExecutor.connect(l1ExecutorAliased),
      l2ERC20TokenGateway,
      l2ERC20TokenGatewayProxy,
      accounts: {
        deployer: l2Deployer,
      },
      provider: l2Provider,
    },
    snapshot: {
      l1: "",
      l2: "",
    },
  };
}
