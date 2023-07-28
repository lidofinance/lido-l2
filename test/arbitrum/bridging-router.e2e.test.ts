import { assert } from "chai";
import { ERC20Mintable } from "../../typechain";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import { Erc20Bridger, getL2Network, L1ToL2MessageStatus } from "@arbitrum/sdk";
import { scenario } from "../../utils/testing";
import arbitrum from "../../utils/arbitrum";

async function ctxFactory() {
  const networkName = env.network("TESTING_ARB_NETWORK", "goerli");
  const testingSetup = await arbitrum.testing(networkName).getE2ETestSetup();

  const l2Network = await getL2Network(testingSetup.l2Provider);

  // replace gateway router addresses with test
  l2Network.tokenBridge.l1GatewayRouter = testingSetup.l1GatewayRouter.address;
  l2Network.tokenBridge.l2GatewayRouter = testingSetup.l2GatewayRouter.address;

  return {
    ...testingSetup,
    l2Network,
    erc20Bridge: new Erc20Bridger(l2Network),
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
  };
}

scenario("Arbitrum :: Bridging E2E test via router", ctxFactory)
  .step(
    "Check test environment is set correctly",
    async ({ erc20Bridge, l1Token, ...ctx }) => {
      assert.equal(
        await erc20Bridge.getL1GatewayAddress(l1Token.address, ctx.l1Provider),
        ctx.l1ERC20TokenGateway.address
      );
      assert.equal(
        await erc20Bridge.getL2GatewayAddress(l1Token.address, ctx.l2Provider),
        ctx.l2ERC20TokenGateway.address
      );
    }
  )

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

    const allowanceTxResponse = await ctx.erc20Bridge.approveToken({
      l1Signer: l1Tester,
      erc20L1Address: l1Token.address,
      amount: wei.toBigNumber(depositAmount),
    });

    await allowanceTxResponse.wait();

    assert.equalBN(
      await l1Token.allowance(l1Tester.address, l1ERC20TokenGateway.address),
      depositAmount
    );
  })

  .step("Deposit tokens to L2 via L1GatewayRouter", async (ctx) => {
    const { l1Tester, l1Token, l2Tester, l2Token, depositAmount } = ctx;
    const l1ERC20TokenGatewayBalanceBefore = await l1Token.balanceOf(
      ctx.l1ERC20TokenGateway.address
    );
    const testerL1TokenBalanceBefore = await l1Token.balanceOf(
      l1Tester.address
    );
    const testerL2TokenBalanceBefore = await l2Token.balanceOf(
      l2Tester.address
    );

    const depositTxResponse = await ctx.erc20Bridge.deposit({
      amount: wei.toBigNumber(depositAmount),
      erc20L1Address: l1Token.address,
      l1Signer: l1Tester,
      l2Provider: ctx.l2Provider,
    });

    const depositL1Receipt = await depositTxResponse.wait();

    assert.equalBN(
      await l1Token.balanceOf(l1Tester.address),
      testerL1TokenBalanceBefore.sub(depositAmount)
    );

    assert.equalBN(
      await l1Token.balanceOf(ctx.l1ERC20TokenGateway.address),
      l1ERC20TokenGatewayBalanceBefore.add(depositAmount)
    );

    const l2Result = await depositL1Receipt.waitForL2(l2Tester.provider);

    assert.isTrue(
      l2Result.complete,
      `L2 message failed: status ${L1ToL2MessageStatus[l2Result.status]}`
    );

    assert.equalBN(
      await l2Token.balanceOf(l2Tester.address),
      testerL2TokenBalanceBefore.add(depositAmount)
    );
  })

  .step("Withdraw tokens from L2 via L2GatewayRouter", async (ctx) => {
    const { l2Token, l2Tester, l1Token, erc20Bridge, withdrawalAmount } = ctx;
    const testerL2TokenBalanceBefore = await l2Token.balanceOf(
      l2Tester.address
    );

    const withdrawTxResponse = await erc20Bridge.withdraw({
      l2Signer: l2Tester,
      erc20l1Address: l1Token.address,
      destinationAddress: l2Tester.address,
      amount: wei.toBigNumber(withdrawalAmount),
    });
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
