import hre, { ethers } from "hardhat";
import { Wallet } from "ethers";
import { assert } from "chai";
import testing, { scenario } from "../../utils/testing";
import optimism from "../../utils/optimism";
import {
  CrossDomainMessengerStub__factory,
  ERC20BridgedStub__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
  OptimismBridgeExecutor__factory,
  ERC20Bridged__factory,
} from "../../typechain";
import { BridgingManagerRole } from "../../utils/bridging-management";
import { wei } from "../../utils/wei";

import network from "../../utils/network";
import addresses from "../../utils/optimism/addresses";
import { getBridgeExecutorParams } from "../../utils/bridge-executor";

scenario("Optimism :: Bridge Executor integration test", ctxFactory)
  .step("Activate L2 bridge", async (ctx) => {
    const {
      accounts: { admin },
      l2ERC20TokenBridge,
      bridgeExecutor,
      l2CrossDomainMessenger,
    } = ctx.l2;

    await l2CrossDomainMessenger.relayMessage(
      bridgeExecutor.address,
      admin.address,
      bridgeExecutor.interface.encodeFunctionData("queue", [
        new Array(4).fill(l2ERC20TokenBridge.address),
        new Array(4).fill(0),
        [
          "grantRole(bytes32,address)",
          "grantRole(bytes32,address)",
          "enableDeposits()",
          "enableWithdrawals()",
        ],
        [
          "0x" +
            l2ERC20TokenBridge.interface
              .encodeFunctionData("grantRole", [
                BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
                bridgeExecutor.address,
              ])
              .substring(10),
          "0x" +
            l2ERC20TokenBridge.interface
              .encodeFunctionData("grantRole", [
                BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash,
                bridgeExecutor.address,
              ])
              .substring(10),
          "0x" +
            l2ERC20TokenBridge.interface
              .encodeFunctionData("enableDeposits")
              .substring(10),
          "0x" +
            l2ERC20TokenBridge.interface
              .encodeFunctionData("enableWithdrawals")
              .substring(10),
        ],
        new Array(4).fill(false),
      ]),
      0
    );

    await bridgeExecutor.execute(0, { value: 0 });

    assert.isTrue(
      await l2ERC20TokenBridge.hasRole(
        BridgingManagerRole.DEPOSITS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isTrue(
      await l2ERC20TokenBridge.hasRole(
        BridgingManagerRole.WITHDRAWALS_ENABLER_ROLE.hash,
        bridgeExecutor.address
      )
    );
    assert.isTrue(await l2ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenBridge.isWithdrawalsEnabled());
  })
  .step("Change Proxy implementation", async (ctx) => {
    const {
      accounts: { admin },
    } = ctx.l1;
    const {
      l2Token,
      l2CrossDomainMessenger,
      l2ERC20TokenBridgeProxy,
      bridgeExecutor,
    } = ctx.l2;
    const proxyImplBefore =
      await l2ERC20TokenBridgeProxy.proxy__getImplementation();

    await l2CrossDomainMessenger.relayMessage(
      bridgeExecutor.address,
      admin.address,
      bridgeExecutor.interface.encodeFunctionData("queue", [
        [l2ERC20TokenBridgeProxy.address],
        [0],
        ["proxy__upgradeTo(address)"],
        [
          "0x" +
            l2ERC20TokenBridgeProxy.interface
              .encodeFunctionData("proxy__upgradeTo", [l2Token.address])
              .substring(10),
        ],
        [false],
      ]),
      0
    );
    const actionSetCount = await bridgeExecutor.getActionsSetCount();

    assert.equalBN(2, actionSetCount);

    await bridgeExecutor.execute(1, { value: 0 });
    const proxyImplAfter =
      await l2ERC20TokenBridgeProxy.proxy__getImplementation();

    assert.notEqual(proxyImplBefore, proxyImplAfter);
    assert.equal(proxyImplAfter, l2Token.address);
  })
  .step("Change proxy Admin", async (ctx) => {
    const {
      accounts: { admin },
    } = ctx.l1;
    const {
      l2CrossDomainMessenger,
      l2ERC20TokenBridgeProxy,
      bridgeExecutor,
      accounts: { sender },
    } = ctx.l2;
    const proxyAdminBefore = await l2ERC20TokenBridgeProxy.proxy__getAdmin();

    await l2CrossDomainMessenger.relayMessage(
      bridgeExecutor.address,
      admin.address,
      bridgeExecutor.interface.encodeFunctionData("queue", [
        [l2ERC20TokenBridgeProxy.address],
        [0],
        ["proxy__changeAdmin(address)"],
        [
          "0x" +
            l2ERC20TokenBridgeProxy.interface
              .encodeFunctionData("proxy__changeAdmin", [sender.address])
              .substring(10),
        ],
        [false],
      ]),
      0
    );
    const actionSetCount = await bridgeExecutor.getActionsSetCount();

    assert.equalBN(3, actionSetCount);

    await bridgeExecutor.execute(2, { value: 0 });
    const proxyAdminAfter = await l2ERC20TokenBridgeProxy.proxy__getAdmin();

    assert.notEqual(proxyAdminBefore, proxyAdminAfter);
    assert.equal(proxyAdminAfter, sender.address);
  })
  .run();

async function ctxFactory() {
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
  } = network.getMultichainNetwork("optimism", "local", privateKeys.deployer);

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );

  const bridgeExecutor = await new OptimismBridgeExecutor__factory(
    l2Deployer
  ).deploy(
    addresses.getL2(await l1Deployer.getChainId()).messenger,
    l1Deployer.address,
    ...getBridgeExecutorParams(),
    l2Deployer.address
  );

  const l1CrossDomainMessengerStub =
    await new CrossDomainMessengerStub__factory(l1Deployer).deploy();

  const [_, l2DeployScript] =
    await optimism.deployment.createOptimismBridgeDeployScripts(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2Deployer.address, bridge: bridgeExecutor.address },
      },
      {
        dependencies: { l1: { messenger: l1CrossDomainMessengerStub.address } },
      }
    );

  await l2DeployScript.run();

  const l2Token = ERC20Bridged__factory.connect(
    l2DeployScript.getContractAddress(1),
    l2Deployer
  );
  const l2ERC20TokenBridge = L2ERC20TokenBridge__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );
  const l2ERC20TokenBridgeProxy = OssifiableProxy__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );

  const l1CrossDomainMessenger =
    await optimism.contracts.l1.L1CrossDomainMessenger(l1Deployer);

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    applyL1ToL2Alias(l1CrossDomainMessenger.address),
    l2Provider
  );

  const l2CrossDomainMessenger =
    await optimism.contracts.l2.L2CrossDomainMessenger(
      l1CrossDomainMessengerAliased
    );

  await l2Deployer.sendTransaction({
    to: await l2CrossDomainMessenger.signer.getAddress(),
    value: wei`10 ether`,
  });

  return {
    l1: {
      accounts: {
        admin: l1Deployer,
      },
    },
    l2: {
      l2Token,
      bridgeExecutor,
      l2ERC20TokenBridge,
      l2CrossDomainMessenger,
      l2ERC20TokenBridgeProxy,
      accounts: {
        sender: new Wallet(privateKeys.sender, l2Provider),
        admin: l2Deployer,
      },
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
