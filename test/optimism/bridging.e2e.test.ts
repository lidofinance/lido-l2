import hre from "hardhat";
import { ERC20Mintable__factory } from "../../typechain";
import network, { getNetworkConfig } from "../../utils/deployment/network";
import { wei } from "../../utils/wei";
import {
  CrossChainMessenger,
  DAIBridgeAdapter,
  MessageStatus,
} from "@eth-optimism/sdk";
import { assert } from "chai";
import { TransactionResponse } from "@ethersproject/providers";

const L1_TOKEN = "0xaF8a2F0aE374b03376155BF745A3421Dac711C12";

const E2E_TEST_CONTRACTS = {
  l1: {
    l1Token: L1_TOKEN,
    l1ERC20TokenBridge: "0xea403E925EA33DFB268047bFf224f1b1D4Fa3883",
  },
  l2: {
    l2Token: "0x2b2b29E8C0f0fA5D16057Ca0cdC9B4152d4B8C9C",
    l2ERC20TokenBridge: "0x43fa1c50c427F181f7afFa357FFcc28b016c20e8",
  },
};

describe("Optimism :: Bridging E2E test", () => {
  const KOVAN_CHAIN_ID = 42;

  const l1Network = getNetworkConfig("kovan", hre);
  const l2Network = getNetworkConfig("kovan_optimism", hre);

  const l1Tester = network.loadAccount(
    l1Network.url,
    "E2E_OPTIMISM_TESTER_PRIVATE_KEY"
  );
  const l2Tester = network.loadAccount(
    l2Network.url,
    "E2E_OPTIMISM_TESTER_PRIVATE_KEY"
  );

  const contracts = E2E_TEST_CONTRACTS;
  const crossChainMessenger = new CrossChainMessenger({
    l1ChainId: KOVAN_CHAIN_ID,
    l1SignerOrProvider: l1Tester,
    l2SignerOrProvider: l2Tester,
    bridges: {
      LidoBridge: {
        Adapter: DAIBridgeAdapter,
        l1Bridge: contracts.l1.l1ERC20TokenBridge,
        l2Bridge: contracts.l2.l2ERC20TokenBridge,
      },
    },
  });
  const l1Token = ERC20Mintable__factory.connect(L1_TOKEN, l1Tester);

  const depositAmount = wei`0.025 ether`;
  const withdrawalAmount = wei`0.025 ether`;

  it("1. Mint L1 token to tester account", async () => {
    await l1Token.mint(l1Tester.address, depositAmount);
  });

  it("2. Set allowance for L1ERC20TokenBridge to deposit", async () => {
    // approve tokens before deposit
    const allowanceTxResponse = await crossChainMessenger.approveERC20(
      contracts.l1.l1Token,
      contracts.l2.l2Token,
      depositAmount
    );

    await allowanceTxResponse.wait();

    assert.equalBN(
      await l1Token.allowance(
        l1Tester.address,
        contracts.l1.l1ERC20TokenBridge
      ),
      depositAmount
    );
  });

  let depositTokensTxResponse: TransactionResponse;
  it("3. Bridge tokens to L2 via depositERC20()", async () => {
    depositTokensTxResponse = await crossChainMessenger.depositERC20(
      contracts.l1.l1Token,
      contracts.l2.l2Token,
      depositAmount
    );
    await depositTokensTxResponse.wait();
  });

  it("4. Waiting for status to change to RELAYED", async () => {
    await crossChainMessenger.waitForMessageStatus(
      depositTokensTxResponse.hash,
      MessageStatus.RELAYED
    );
  });

  let withdrawTokensTxResponse: TransactionResponse;
  it("5. Withdraw tokens from L2 via withdrawERC20()", async () => {
    withdrawTokensTxResponse = await crossChainMessenger.withdrawERC20(
      contracts.l1.l1Token,
      contracts.l2.l2Token,
      withdrawalAmount
    );
    await withdrawTokensTxResponse.wait();
  });

  it("6. Waiting for status to change to IN_CHALLENGE_PERIOD", async () => {
    await crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse.hash,
      MessageStatus.IN_CHALLENGE_PERIOD
    );
  });

  it("7. Waiting for status to change to READY_FOR_RELAY", async () => {
    await crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse.hash,
      MessageStatus.READY_FOR_RELAY
    );
  });

  it("8. Finalizing L2 -> L1 message", async () => {
    await crossChainMessenger.finalizeMessage(withdrawTokensTxResponse);
  });

  it("9. Waiting for status to change to RELAYED", async () => {
    await crossChainMessenger.waitForMessageStatus(
      withdrawTokensTxResponse,
      MessageStatus.RELAYED
    );
  });

  it("10. Set allowance for L1ERC20TokenBridge to deposit", async () => {
    const allowanceTxResponse = await crossChainMessenger.approveERC20(
      contracts.l1.l1Token,
      contracts.l2.l2Token,
      depositAmount
    );

    await allowanceTxResponse.wait();

    assert.equalBN(
      await l1Token.allowance(
        l1Tester.address,
        contracts.l1.l1ERC20TokenBridge
      ),
      depositAmount
    );
  });
});
