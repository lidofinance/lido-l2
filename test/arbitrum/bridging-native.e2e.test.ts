import { assert } from "chai";
import { ERC20Mintable } from "../../typechain";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import {
  getL2Network,
  L1ToL2MessageStatus,
  L1TransactionReceipt,
} from "@arbitrum/sdk";
import { scenario } from "../../utils/testing";
import arbitrum from "../../utils/arbitrum";
import { ethers } from "hardhat";

async function ctxFactory() {
  const networkName = env.network("TESTING_ARB_NETWORK", "sepolia");
  const testingSetup = await arbitrum.testing(networkName).getE2ETestSetup();

  const l2Network = await getL2Network(testingSetup.l2Provider);

  // replace gateway router addresses with test
  l2Network.tokenBridge.l1GatewayRouter = testingSetup.l1GatewayRouter.address;
  l2Network.tokenBridge.l2GatewayRouter = testingSetup.l2GatewayRouter.address;

  return {
    ...testingSetup,
    messaging: arbitrum.messaging(networkName, {
      forking: false,
      customAddresses: {
        L1GatewayRouter: testingSetup.l1GatewayRouter.address,
        L2GatewayRouter: testingSetup.l2GatewayRouter.address,
      },
    }),
    l2Network,
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
  };
}

scenario("Arbitrum :: Bridging E2E test natively", ctxFactory)
  .step("Validate tester has required amount of L1 token", async (ctx) => {
    const { l1Token, l1Tester, depositAmount } = ctx;
    const balanceBefore = await l1Token.balanceOf(l1Tester.address);
    if (balanceBefore.lt(depositAmount)) {
      try {
        await (l1Token as ERC20Mintable).mint(l1Tester.address, depositAmount);
      } catch {}
    }
    const balanceAfter = await l1Token.balanceOf(l1Tester.address);
    assert.isTrue(
      balanceAfter.gte(depositAmount),
      "Tester has not enough L1 token"
    );
  })

  .step("Set allowance for L1ERC20TokenGateway to deposit", async (ctx) => {
    const { l1Tester, l1Token, depositAmount, l1ERC20TokenGateway } = ctx;

    const allowanceTxResponse = await l1Token
      .connect(l1Tester)
      .approve(l1ERC20TokenGateway.address, wei.toBigNumber(depositAmount));

    await allowanceTxResponse.wait();

    assert.equalBN(
      await l1Token.allowance(l1Tester.address, l1ERC20TokenGateway.address),
      depositAmount
    );
  })

  .step("Deposit tokens to L2 via L1ERC20Gateway", async (ctx) => {
    const {
      l1Tester,
      l1Token,
      l2Tester,
      l2Token,
      depositAmount,
      l1ERC20TokenGateway,
      l2ERC20TokenGateway,
    } = ctx;
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      ctx.l1ERC20TokenGateway.address
    );
    const testerL1TokenBalanceBefore = await l1Token.balanceOf(
      l1Tester.address
    );
    const testerL2TokenBalanceBefore = await l2Token.balanceOf(
      l2Tester.address
    );

    // To estimate params required for L1 -> L2 retryable ticket creation
    // we need to know which message will be send on L2
    const finalizeInboundTransferCalldata =
      await l1ERC20TokenGateway.getOutboundCalldata(
        l1Token.address,
        l1Tester.address,
        l1Tester.address,
        wei.toBigNumber(depositAmount),
        "0x"
      );

    const { callvalue, gasPriceBid, maxGas, maxSubmissionCost } =
      await ctx.messaging.getRetryableTicketSendParams({
        callvalue: 0,
        sender: l1ERC20TokenGateway.address,
        recipient: l2ERC20TokenGateway.address,
        calldata: finalizeInboundTransferCalldata,
        refundAddress: l2Tester.address,
      });

    const maxSubmissionCostEncoded = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes"],
      [maxSubmissionCost, "0x"]
    );

    const depositTxResponse = await l1ERC20TokenGateway
      .connect(l1Tester)
      .outboundTransfer(
        l1Token.address,
        l1Tester.address,
        depositAmount,
        maxGas,
        gasPriceBid,
        maxSubmissionCostEncoded,
        { value: callvalue }
      );

    const depositL1Receipt = await depositTxResponse.wait();

    assert.equalBN(
      await l1Token.balanceOf(l1Tester.address),
      testerL1TokenBalanceBefore.sub(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(ctx.l1ERC20TokenGateway.address),
      l1ERC20TokenGatewayBalanceBefore.add(depositAmount)
    );

    const l1TxReceipt = new L1TransactionReceipt(depositL1Receipt);

    const [message] = await l1TxReceipt.getL1ToL2Messages(l2Tester);

    const { status } = await message.waitForStatus();

    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      console.warn(
        `Auto redeem for tx ${l1TxReceipt.transactionHash} failed. Redeeming it manually...`
      );
      const redeemResponse = await message.redeem({ gasLimit: 300_000 });
      await redeemResponse.wait();
      console.log("Tx was redeemed");
    } else if (status === L1ToL2MessageStatus.REDEEMED) {
      console.log("Tx was auto redeemed");
    } else {
      assert.isTrue(
        false,
        `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
      );
    }

    assert.equalBN(
      await l2Token.balanceOf(l2Tester.address),
      testerL2TokenBalanceBefore.add(depositAmount)
    );
  })

  .step("Withdraw tokens from L2 via L2ERC20Gateway", async (ctx) => {
    const {
      l2Token,
      l1Tester,
      l2Tester,
      l1Token,
      withdrawalAmount,
      l2ERC20TokenGateway,
    } = ctx;

    const testerL2TokenBalanceBefore = await l2Token.balanceOf(
      l2Tester.address
    );

    const withdrawTxResponse = await l2ERC20TokenGateway.outboundTransfer(
      l1Token.address,
      l1Tester.address,
      withdrawalAmount,
      wei`0`,
      wei`0`,
      "0x"
    );

    const withdrawRec = await withdrawTxResponse.wait();

    console.log(`Token withdrawal initiated: ${withdrawRec.transactionHash}`);

    assert.equalBN(
      await l2Token.balanceOf(l2Tester.address),
      testerL2TokenBalanceBefore.sub(withdrawalAmount)
    );
  })

  .step(
    "L2 -> L1 transactions takes much time and must be redeemed manually",
    async () => {}
  )

  .run();
