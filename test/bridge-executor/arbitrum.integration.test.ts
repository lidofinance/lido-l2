import hre, { ethers } from "hardhat";
import testing, { scenario } from "../../utils/testing";
import {
  ArbSysStub__factory,
  ERC20BridgedStub__factory,
  L2ERC20TokenGateway__factory,
  ArbitrumBridgeExecutor__factory,
  ERC20Bridged__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import { assert } from "chai";
import { getBridgeExecutorParams } from "../../utils/bridge-executor";
import { BridgingManagerRole } from "../../utils/bridging-management";

import arbitrum from "../../utils/arbitrum";
import network from "../../utils/network";

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

    await bridgeExecutor.execute(0, { value: 0 });

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

    assert.equalBN(2, actionSetCount);

    await bridgeExecutor.execute(1, { value: 0 });
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
    assert.equalBN(3, actionSetCount);

    await bridgeExecutor.execute(2, { value: 0 });
    const proxyAdminAfter = await l2ERC20TokenGatewayProxy.proxy__getAdmin();

    assert.notEqual(proxyAdminBefore, proxyAdminAfter);
    assert.equal(proxyAdminAfter, deployer.address);
  })

  .run();

async function ctx() {
  const privateKeys = {
    deployer:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    sender:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    recipient:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  };
  const {
    l1: { signer: l1Deployer },
    l2: { signer: l2Deployer, provider: l2Provider },
  } = network.getMultichainNetwork("arbitrum", "local", privateKeys.deployer);

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );
  const arbSysStub = await new ArbSysStub__factory(l2Deployer).deploy();
  const bridgeExecutorContract = await new ArbitrumBridgeExecutor__factory(
    l2Deployer
  ).deploy(
    l1Deployer.address,
    ...getBridgeExecutorParams(),
    l2Deployer.address
  );

  const [_, l2DeployScript] =
    await arbitrum.deployment.createGatewayDeployScripts(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: {
          proxy: bridgeExecutorContract.address,
          bridge: bridgeExecutorContract.address,
        },
      },
      {
        dependencies: {
          l2: {
            arbSys: arbSysStub.address,
          },
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
    applyL1ToL2Alias(l1Deployer.address),
    l2Provider
  );
  await l2Deployer.sendTransaction({
    to: await l1ExecutorAliased.getAddress(),
    value: wei`1 ether`,
  });
  const l2Executor = await testing.impersonate(
    applyL1ToL2Alias(l1Deployer.address),
    l2Provider
  );
  const bridgeExecutor = ArbitrumBridgeExecutor__factory.connect(
    bridgeExecutorContract.address,
    l2Executor
  );

  return {
    l2: {
      l2Token,
      bridgeExecutor,
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

function applyL1ToL2Alias(address: string) {
  const offset = "0x1111000000000000000000000000000000001111";
  const mask = ethers.BigNumber.from(2).pow(160);
  return hre.ethers.utils.getAddress(
    hre.ethers.BigNumber.from(address).add(offset).mod(mask).toHexString()
  );
}
