import {
  CrossChainMessenger,
  ERC20BridgeAdapter,
  MessageStatus,
} from "@mantleio/sdk";
import { assert } from "chai";
import { TransactionResponse } from "@ethersproject/providers";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import mantle from "../../utils/mantle";
import { ERC20Mintable } from "../../typechain";
import { scenario } from "../../utils/testing";

let depositTokensTxResponse: TransactionResponse;
let withdrawTokensTxResponse: TransactionResponse;

scenario("Mantle :: Bridging via deposit/withdraw E2E test", ctxFactory)
  .step(
    "Validate tester has required amount of L1 token",
    async ({ l1Token, l1Tester, depositAmount }) => {
      const balanceBefore = await l1Token.balanceOf(l1Tester.address);
      if (balanceBefore.lt(depositAmount)) {
        try {
          await (l1Token as ERC20Mintable).mint(
            l1Tester.address,
            depositAmount
          );
        } catch {}
        const balanceAfter = await l1Token.balanceOf(l1Tester.address);
        assert.isTrue(
          balanceAfter.gte(depositAmount),
          "Tester has not enough L1 token"
        );
      }
    }
  )

  .step("Set allowance for L1ERC20TokenBridge to deposit", async (ctx) => {
    const allowanceTxResponse = await ctx.crossChainMessenger.approveERC20(
      ctx.l1Token.address,
      ctx.l2Token.address,
      ctx.depositAmount
    );

    await allowanceTxResponse.wait();

    assert.equalBN(
      await ctx.l1Token.allowance(
        ctx.l1Tester.address,
        ctx.l1ERC20TokenBridge.address
      ),
      ctx.depositAmount
    );
  })

  .step("Bridge tokens to L2 via depositERC20()", async (ctx) => {
    depositTokensTxResponse = await ctx.crossChainMessenger.depositERC20(
      ctx.l1Token.address,
      ctx.l2Token.address,
      ctx.depositAmount
    );
    await depositTokensTxResponse.wait();
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      depositTokensTxResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step("Withdraw tokens from L2 via withdrawERC20()", async (ctx) => {
    withdrawTokensTxResponse = await ctx.crossChainMessenger.withdrawERC20(
      ctx.l1Token.address,
      ctx.l2Token.address,
      ctx.withdrawalAmount
    );
    await withdrawTokensTxResponse.wait();
  })

  // .step("Waiting for status to change to READY_TO_PROVE", async (ctx) => {
  //   await ctx.crossChainMessenger.waitForMessageStatus(
  //     withdrawTokensTxResponse.hash,
  //     MessageStatus.READY_TO_PROVE
  //   );
  // })

  // .step("Proving the L2 -> L1 message", async (ctx) => {
  //   const tx = await ctx.crossChainMessenger.proveMessage(
  //     withdrawTokensTxResponse.hash
  //   );
  //   await tx.wait();
  // })

  .step("Waiting for status to change to IN_CHALLENGE_PERIOD", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse.hash,
      MessageStatus.IN_CHALLENGE_PERIOD
    );
  })

  .step("Waiting for status to change to READY_FOR_RELAY", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse.hash,
      MessageStatus.READY_FOR_RELAY
    );
  })

  .step("Finalizing L2 -> L1 message", async (ctx) => {
    await ctx.crossChainMessenger.finalizeMessage(withdrawTokensTxResponse);
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse,
      MessageStatus.RELAYED
    );
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_MNT_NETWORK", "goerli");
  const testingSetup = await mantle.testing(networkName).getE2ETestSetup();

  return {
    depositAmount: wei`0.0025 ether`,
    withdrawalAmount: wei`0.0025 ether`,
    l1Tester: testingSetup.l1Tester,
    l1Token: testingSetup.l1Token,
    l2Token: testingSetup.l2Token,
    l1ERC20TokenBridge: testingSetup.l1ERC20TokenBridge,
    crossChainMessenger: new CrossChainMessenger({
      l2ChainId: network.chainId("mnt", networkName),
      l1ChainId: network.chainId("eth", networkName),
      l1SignerOrProvider: testingSetup.l1Tester,
      l2SignerOrProvider: testingSetup.l2Tester,
      bridges: {
        LidoBridge: {
          Adapter: ERC20BridgeAdapter,
          l1Bridge: testingSetup.l1ERC20TokenBridge.address,
          l2Bridge: testingSetup.l2ERC20TokenBridge.address,
        },
      },
    }),
  };
}
