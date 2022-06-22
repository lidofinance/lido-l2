import { assert } from "chai";
import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  L1ERC20TokenGateway__factory,
} from "../../typechain";
import env from "../../utils/env";
import network from "../../utils/network";
import { wei } from "../../utils/wei";
import { Erc20Bridger, getL2Network, L1ToL2MessageStatus } from "@arbitrum/sdk";
import { scenario } from "../../utils/testing";
import { L2ERC20Gateway__factory } from "arb-ts";

const L1_TOKEN = "0x7AEE39c46f20135114e85A03C02aB4FE73fB8127";

const E2E_TEST_CONTRACTS = {
  l1: {
    l1Token: L1_TOKEN,
    l1GatewayRouter: "0xa2a8F940752aDc4A3278B63B96d56D72D2b075B1",
    l1ERC20TokenGateway: "0x9d5B451458D7C7DB881FF1085cF5bCBaF00A8A7A",
  },
  l2: {
    l2Token: "0x5EB70ba2E9F8263C00efeAAE60cfE5f486dD8749",
    l2GatewayRouter: "0x57f54f87C44d816f60b92864e23b8c0897D4d81D",
    l2ERC20TokenGateway: "0xCa7daa65bA116d1664540D638A8aA705cB3C6950",
  },
};

async function ctxFactory() {
  const pk = env.string("E2E_TESTER_PRIVATE_KEY");

  const {
    l1: { provider: l1Provider, signer: l1Tester },
    l2: { provider: l2Provider, signer: l2Tester },
  } = network.getMultichainNetwork("arbitrum", "testnet", pk);

  const l2Network = await getL2Network(l2Provider);

  // replace gateway router addresses with test
  l2Network.tokenBridge.l1GatewayRouter = E2E_TEST_CONTRACTS.l1.l1GatewayRouter;
  l2Network.tokenBridge.l2GatewayRouter = E2E_TEST_CONTRACTS.l2.l2GatewayRouter;

  return {
    l1Tester,
    l2Tester,
    l1Provider,
    l2Provider,
    l1Token: ERC20Mintable__factory.connect(L1_TOKEN, l1Tester),
    l2Token: ERC20Bridged__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2Token,
      l2Tester
    ),
    l1ERC20TokenGateway: L1ERC20TokenGateway__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1ERC20TokenGateway,
      l1Tester
    ),
    l2ERC20TokenGateway: L2ERC20Gateway__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenGateway,
      l2Tester
    ),
    l2Network,
    erc20Bridge: new Erc20Bridger(l2Network),
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
  };
}

scenario("Arbitrum :: Bridging E2E test", ctxFactory)
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

  .step("Mint L1 token to tester account if needed", async (ctx) => {
    const { l1Token, l1Tester, depositAmount } = ctx;
    const balanceBefore = await l1Token.balanceOf(l1Tester.address);
    if (balanceBefore.lt(depositAmount)) {
      await l1Token.mint(l1Tester.address, depositAmount);
    }
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
      amount: wei.toBigNumber(withdrawalAmount),
      erc20l1Address: l1Token.address,
      l2Signer: l2Tester,
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
