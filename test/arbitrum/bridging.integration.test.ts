import hre, { ethers } from "hardhat";
import {
  getDeployer,
  getNetworkConfig,
  getProvider,
} from "../../utils/deployment/network";
import { impersonate } from "../../utils/account";
import { createArbitrumGatewayDeployScripts } from "../../utils/deployment/arbitrum";
import {
  ArbSysStub__factory,
  ERC20Ownable__factory,
  ERC20Stub__factory,
  IMessageProvider__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import { assert } from "chai";

import arbitrum from "../../utils/arbitrum";
import bridging from "../../utils/bridging";
import { scenario } from "../../utils/testing";

scenario("Arbitrum :: Bridging integration test", ctxProvider, async (ctx) => {
  it("1. Activate Bridging", async () => {
    const {
      l1: {
        l1ERC20TokenGateway,
        accounts: { admin },
      },
      l2: { l2ERC20TokenGateway },
    } = ctx;

    await bridging.grantRoles(l1ERC20TokenGateway, {
      depositEnablers: [admin.address],
      withdrawalsEnablers: [admin.address],
    });
    await bridging.grantRoles(l2ERC20TokenGateway, {
      depositEnablers: [admin.address],
      withdrawalsEnablers: [admin.address],
    });
    await bridging.activate(l1ERC20TokenGateway);
    await bridging.activate(l2ERC20TokenGateway);

    assert.isTrue(await l1ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenGateway.isWithdrawalsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenGateway.isWithdrawalsEnabled());
  });

  it("2. Set L1ERC20TokenGateway for new token in L1GatewayRouter", async () => {
    const { l1GatewayRouter, l1ERC20TokenGateway, l1Token } = ctx.l1;
    const { l1GatewayRouterAdmin } = ctx.l1.accounts;
    const { maxGas, gasPriceBid, maxSubmissionCost, callValue } = ctx.common;

    await l1GatewayRouter
      .connect(l1GatewayRouterAdmin)
      .setGateways(
        [l1Token.address],
        [l1ERC20TokenGateway.address],
        maxGas,
        gasPriceBid,
        maxSubmissionCost,
        { value: callValue }
      );

    assert.equal(
      await l1GatewayRouter.getGateway(l1Token.address),
      l1ERC20TokenGateway.address
    );
  });

  it("3. Set L2ERC20TokenGateway for new token in L2GatewayRouter", async () => {
    const { l1Token } = ctx.l1;
    const { l2GatewayRouter, l2ERC20TokenGateway } = ctx.l2;
    const { l1GatewayRouterAliased } = ctx.l2.accounts;

    await l2GatewayRouter
      .connect(l1GatewayRouterAliased)
      .setGateway([l1Token.address], [l2ERC20TokenGateway.address]);

    assert.equal(
      await l2GatewayRouter.getGateway(l1Token.address),
      l2ERC20TokenGateway.address
    );
  });

  it("4. Bridge tokens via L1ERC20TokenGateway", async () => {
    const { recipient } = ctx.l1.accounts;
    const { l1Token, l1ERC20TokenGateway, l1GatewayRouter } = ctx.l1;
    const {
      amount,
      outbdoundTransferData,
      maxGas,
      gasPriceBid,
      callValue,
      finalizeInboundTransferCalldata,
    } = ctx.common;

    await l1Token.approve(l1ERC20TokenGateway.address, amount);

    const tx = await l1GatewayRouter.outboundTransfer(
      l1Token.address,
      recipient.address,
      amount,
      maxGas,
      gasPriceBid,
      outbdoundTransferData,
      { value: callValue }
    );

    const receipt = await tx.wait();

    const messageProviderInterface =
      IMessageProvider__factory.createInterface();
    const inboxMessageDeliveredTopic = messageProviderInterface.getEventTopic(
      "InboxMessageDelivered"
    );
    const messageDeliveredLog = receipt.logs.find(
      (l) => l.topics[0] === inboxMessageDeliveredTopic
    );
    if (!messageDeliveredLog) {
      throw new Error("InboxMessageDelivered message wasn't fired");
    }
    const messageDeliveredEvent =
      messageProviderInterface.parseLog(messageDeliveredLog);

    // Validate that message data were passed correctly.
    // Inbox contract uses the abi.encodePackedValue(), so it's an overhead
    // to parse all data of the event when we only need the last one
    assert.isTrue(
      messageDeliveredEvent.args.data.endsWith(
        finalizeInboundTransferCalldata.slice(2)
      )
    );
  });

  it("5. Simulate finalizeTransfer() on L2", async () => {
    const { l1Token } = ctx.l1;
    const { admin } = ctx.l1.accounts;
    const { l2Token, l2ERC20TokenGateway } = ctx.l2;
    const { l1ERC20TokenGatewayAliased, recipient } = ctx.l2.accounts;
    const { finalizeInboundTransferCalldata, amount } = ctx.common;

    const tx = await l1ERC20TokenGatewayAliased.sendTransaction({
      to: l2ERC20TokenGateway.address,
      data: finalizeInboundTransferCalldata,
    });

    await assert.emits(l2Token, tx, "Transfer", [
      ethers.constants.AddressZero,
      recipient.address,
      amount,
    ]);
    await assert.emits(l2ERC20TokenGateway, tx, "DepositFinalized", [
      l1Token.address,
      admin.address,
      recipient.address,
      amount,
    ]);
    assert.equalBN(await l2Token.totalSupply(), amount);
    assert.equalBN(await l2Token.balanceOf(recipient.address), amount);
  });

  it("6. Withdraw tokens from L2 ", async () => {
    const { l1Token, l1ERC20TokenGateway } = ctx.l1;
    const { recipient } = ctx.l1.accounts;
    const {
      l2GatewayRouter,
      l2Token,
      arbSysStub: arbySysStub,
      l2ERC20TokenGateway,
    } = ctx.l2;
    const { admin } = ctx.l2.accounts;
    const { amount, finalizeInboundTransferCalldata } = ctx.common;

    const tx = await l2GatewayRouter[
      "outboundTransfer(address,address,uint256,bytes)"
    ](l1Token.address, recipient.address, amount, "0x");

    await assert.emits(l2Token, tx, "Transfer", [
      recipient.address,
      ethers.constants.AddressZero,
      amount,
    ]);

    await assert.emits(arbySysStub, tx, "CreateL2ToL1Tx", [
      l1ERC20TokenGateway.address,
      finalizeInboundTransferCalldata,
    ]);

    await assert.emits(l2ERC20TokenGateway, tx, "WithdrawalInitiated", [
      l1Token.address,
      admin.address,
      recipient.address,
      0,
      0,
      amount,
    ]);
  });

  it("7. Simulate finalizeTransfer() on L1", async () => {});
});

async function ctxProvider() {
  const l1Network = getNetworkConfig("local", hre);
  const l2Network = getNetworkConfig("local_arbitrum", hre);
  const l1Provider = getProvider(l1Network.url);
  const l2Provider = getProvider(l2Network.url);
  const l1Deployer = getDeployer(l1Network.url);
  const l2Deployer = getDeployer(l2Network.url);

  const l1Token = await new ERC20Stub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );

  const arbSysStub = await new ArbSysStub__factory(l2Deployer).deploy();

  const [l1DeployScript, l2DeployScript] =
    await createArbitrumGatewayDeployScripts(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2Deployer.address, bridge: l2Deployer.address },
      },
      { dependencies: { l2: { arbSys: arbSysStub.address } } }
    );

  await l1DeployScript.run();
  await l2DeployScript.run();

  const l2Token = ERC20Ownable__factory.connect(
    l2DeployScript.getContractAddress(1),
    l2Deployer
  );
  const l2ERC20TokenGateway = L2ERC20TokenGateway__factory.connect(
    l2DeployScript.getContractAddress(3),
    l2Deployer
  );
  const l1ERC20TokenGateway = L1ERC20TokenGateway__factory.connect(
    l1DeployScript.getContractAddress(1),
    l1Deployer
  );

  const l1GatewayRouterAdmin = await arbitrum.accounts.l1.L1GatewayRouterAdmin(
    l1Provider
  );
  const l1GatewayRouter = await arbitrum.contracts.l1.L1GatewayRouter(
    l1GatewayRouterAdmin
  );

  const l1ERC20TokenGatewayAliased = await impersonate(
    applyL1ToL2Alias(l1ERC20TokenGateway.address),
    l2Provider
  );

  const l1GatewayRouterAliased = await impersonate(
    applyL1ToL2Alias(l1GatewayRouter.address),
    l2Provider
  );

  await l2Deployer.sendTransaction({
    to: await l1ERC20TokenGatewayAliased.getAddress(),
    value: wei`1 ether`,
  });

  const l2GatewayRouter = await arbitrum.contracts.l2.L2GatewayRouter(
    l2Deployer
  );

  const amount = wei`1 ether`;
  const maxSubmissionCost = wei`200_000 gwei`;

  return {
    l1: {
      l1Token,
      l1ERC20TokenGateway,
      accounts: {
        admin: l1Deployer,
        recipient: l1Deployer,
        l1GatewayRouterAdmin,
      },
      l1GatewayRouter: l1GatewayRouter.connect(l1Deployer),
    },
    l2: {
      l2Token,
      l2GatewayRouter,
      l2ERC20TokenGateway,
      arbSysStub,
      accounts: {
        admin: l2Deployer,
        recipient: l2Deployer,
        l1GatewayRouterAliased,
        l1ERC20TokenGatewayAliased,
      },
    },
    common: {
      amount,
      maxGas: wei`300_000 gwei`,
      gasPriceBid: wei`1 wei`,
      callValue: wei`500_000 gwei`,
      maxSubmissionCost,
      // data for outboundTransfer must contain encoded tuple with (maxSubmissionCost, emptyData)
      outbdoundTransferData: ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [maxSubmissionCost, "0x"]
      ),
      finalizeInboundTransferCalldata:
        l2ERC20TokenGateway.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [
            l1Token.address,
            l1Deployer.address,
            l1Deployer.address,
            amount,
            "0x",
          ]
        ),
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
