import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  L1ERC20TokenBridge__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import {
  CrossChainMessenger,
  DAIBridgeAdapter,
  MessageStatus,
} from "@eth-optimism/sdk";
import { assert } from "chai";
import { TransactionResponse } from "@ethersproject/providers";
import network from "../../utils/network";
import env from "../../utils/env";
import { scenario } from "../../utils/testing";

const E2E_TEST_CONTRACTS = {
  l1: {
    l1Token: "0xaF8a2F0aE374b03376155BF745A3421Dac711C12",
    l1ERC20TokenBridge: "0x243b661276670bD17399C488E7287ea4D416115b",
  },
  l2: {
    l2Token: "0xAED5F9aaF167923D34174b8E636aaF040A11f6F7",
    l2ERC20TokenBridge: "0x447CD1794d209Ac4E6B4097B34658bc00C4d0a51",
  },
};

let depositTokensTxResponse: TransactionResponse;
let withdrawTokensTxResponse: TransactionResponse;

scenario("Optimism :: Bridging E2E test", ctxFactory)
  .step(
    "Mint L1 token to tester account",
    async ({ l1Token, l1Tester, depositAmount }) => {
      const balanceBefore = await l1Token.balanceOf(l1Tester.address);
      if (balanceBefore.lt(depositAmount)) {
        await l1Token.mint(l1Tester.address, depositAmount);
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

  .run();

async function ctxFactory() {
  const pk = env.string("E2E_TESTER_PRIVATE_KEY");
  const {
    l1: { signer: l1Tester },
    l2: { signer: l2Tester },
  } = network.getMultichainNetwork("optimism", "testnet", pk);

  return {
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
    l1Tester,
    l1Token: ERC20Mintable__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1Token,
      l1Tester
    ),
    l2Token: ERC20Bridged__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2Token,
      l2Tester
    ),
    l1ERC20TokenBridge: L1ERC20TokenBridge__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1ERC20TokenBridge,
      l1Tester
    ),
    crossChainMessenger: new CrossChainMessenger({
      l1ChainId: 42,
      l1SignerOrProvider: l1Tester,
      l2SignerOrProvider: l2Tester,
      bridges: {
        LidoBridge: {
          Adapter: DAIBridgeAdapter,
          l1Bridge: E2E_TEST_CONTRACTS.l1.l1ERC20TokenBridge,
          l2Bridge: E2E_TEST_CONTRACTS.l2.l2ERC20TokenBridge,
        },
      },
    }),
  };
}
