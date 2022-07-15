import {
  ERC20Bridged__factory,
  ERC20Mintable__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  GovBridgeExecutor__factory,
  Voting__factory,
} from "../../typechain";
import { wei } from "../../utils/wei";
import {
  CrossChainMessenger,
  DAIBridgeAdapter,
  MessageStatus,
  MessageDirection,
} from "@eth-optimism/sdk";
import { assert, expect } from "chai";
import { TransactionResponse } from "@ethersproject/providers";
import network from "../../utils/network";
import env from "../../utils/env";
import { scenario } from "../../utils/testing";

const E2E_TEST_CONTRACTS = {
  l1: {
    l1Token: "0xaF8a2F0aE374b03376155BF745A3421Dac711C12",
    l1ERC20TokenBridge: "0x243b661276670bD17399C488E7287ea4D416115b",
    aragonVoting: "0x0x86f4C03aB9fCE83970Ce3FC7C23f25339f484EE5",
    l1LDOToken: "0xcAdf242b97BFdD1Cb4Fd282E5FcADF965883065f",
  },
  l2: {
    l2Token: "0xAED5F9aaF167923D34174b8E636aaF040A11f6F7",
    l2ERC20TokenBridge: "0x491dB42FC78D8393Db7a8AC77BFF68d2CfFb1457",
    govBridgeExecutor: "0xEB18048D470cdb1a7906565d582ec57490B4bd22",
  },
};

const DEPOSIT_ENABLER_ROLE = "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a"
const DEPOSIT_DISABLER_ROLE = "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6"

let grantRoleMessageResponse: TransactionResponse;
let enableDepositsMessageResponse: TransactionResponse;
let disableDepositsMessageResponse: TransactionResponse;


scenario("Optimism :: AAVE governance crosschain bridge", ctxFactory)
  .step(
    "LDO Holder has enought ETH",
    async ({ l1LDOHolder, l1Tester, gasAmount}) => {
      expect(await l1LDOHolder.getBalance()).to.gte(gasAmount);
    }
  )

  .step("L2 Deposits should be enabled", async ({
    l2ERC20TokenBridge
  }) => {
    expect(await l2ERC20TokenBridge.isDepositsEnabled()).to.eq(true);
  })

  .step("Send grant stop role message to L2", async ({
    l2ERC20TokenBridge, 
    govBridgeExecutor,
    crossChainMessenger,
  }) => {
    const grantRoleL2Data = await l2ERC20TokenBridge.interface.encodeFunctionData(
      "grantRole",
      [
        DEPOSIT_DISABLER_ROLE,
        govBridgeExecutor.address
      ]
    )
    const bridgeCalldata = "0x" + grantRoleL2Data.substring(10)
    
    const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
      "queue",
      [
        [l2ERC20TokenBridge.address],
        [0],
        ["grantRole(bytes32,address)"],
        [bridgeCalldata],
        [false]
      ]
    )
    
    grantRoleMessageResponse = await crossChainMessenger.sendMessage({
      target: govBridgeExecutor.address,
      message: executorCalldata,
      direction: MessageDirection.L1_TO_L2,
    },
    {
      l2GasLimit: 1000000
    })

    await grantRoleMessageResponse.wait();
    
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      grantRoleMessageResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step("Execute queued task", async ({govBridgeExecutor}) => {
    const tasksCount = (await govBridgeExecutor.getActionsSetCount()).toNumber()
    await govBridgeExecutor.execute(tasksCount - 1, {gasLimit: 1000000})
  })

  .step("Send disable deposits message to L2", async ({
    l2ERC20TokenBridge, 
    govBridgeExecutor,
    crossChainMessenger,
  }) => {
    const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
      "queue",
      [
        [l2ERC20TokenBridge.address],
        [0],
        ["disableDeposits()"],
        ["0x00"],
        [false]
      ]
    )
    
    disableDepositsMessageResponse = await crossChainMessenger.sendMessage({
      target: govBridgeExecutor.address,
      message: executorCalldata,
      direction: MessageDirection.L1_TO_L2,
    },
    {
      l2GasLimit: 1000000
    })

    await disableDepositsMessageResponse.wait();
    
  })


  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      disableDepositsMessageResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step("Execute queued task", async ({govBridgeExecutor}) => {
    const tasksId = (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1
    await govBridgeExecutor.execute(tasksId, {gasLimit: 1000000})
  })

  .step("L2 Deposits should be disabled", async ({
    l2ERC20TokenBridge
  }) => {
    expect(await l2ERC20TokenBridge.isDepositsEnabled()).to.eq(false);
  })

  .step("Send grant start role message to L2", async ({
    l2ERC20TokenBridge, 
    govBridgeExecutor,
    crossChainMessenger,
  }) => {
    const grantRoleL2Data = await l2ERC20TokenBridge.interface.encodeFunctionData(
      "grantRole",
      [
        DEPOSIT_ENABLER_ROLE,
        govBridgeExecutor.address
      ]
    )
    const bridgeCalldata = "0x" + grantRoleL2Data.substring(10)
    
    const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
      "queue",
      [
        [l2ERC20TokenBridge.address],
        [0],
        ["grantRole(bytes32,address)"],
        [bridgeCalldata],
        [false]
      ]
    )
    
    grantRoleMessageResponse = await crossChainMessenger.sendMessage({
      target: govBridgeExecutor.address,
      message: executorCalldata,
      direction: MessageDirection.L1_TO_L2,
    },
    {
      l2GasLimit: 1000000
    })

    await grantRoleMessageResponse.wait();
    
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      grantRoleMessageResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step("Execute queued task", async ({govBridgeExecutor}) => {
    const tasksId = (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1
    await govBridgeExecutor.execute(tasksId, {gasLimit: 1000000})
  })

  .step("Send enable deposits message to L2", async ({
    l2ERC20TokenBridge, 
    govBridgeExecutor,
    crossChainMessenger,
  }) => {
    const executorCalldata = await govBridgeExecutor.interface.encodeFunctionData(
      "queue",
      [
        [l2ERC20TokenBridge.address],
        [0],
        ["enableDeposits()"],
        ["0x00"],
        [false]
      ]
    )
    
    enableDepositsMessageResponse = await crossChainMessenger.sendMessage({
      target: govBridgeExecutor.address,
      message: executorCalldata,
      direction: MessageDirection.L1_TO_L2,
    },
    {
      l2GasLimit: 1000000
    })

    await enableDepositsMessageResponse.wait();
    
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      enableDepositsMessageResponse.hash,
      MessageStatus.RELAYED
    );
    
  })

  .step("Execute queued task", async ({govBridgeExecutor}) => {
    const tasksId = (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1
    await govBridgeExecutor.execute(tasksId, {gasLimit: 1000000})
  })

  .step("L2 Deposits should be enabled", async ({
    l2ERC20TokenBridge
  }) => {
    expect(await l2ERC20TokenBridge.isDepositsEnabled()).to.eq(true);
  })

  .run();

async function ctxFactory() {
  const pk = env.string("E2E_TESTER_PRIVATE_KEY");
  const {
    l1: { signer: l1Tester },
    l2: { signer: l2Tester },
  } = network.getMultichainNetwork("optimism", "testnet", pk);
  const ldo_holder_pk = env.string("E2E_KOVAN_LDO_HOLDER_PRIVATE_KEY")
  const {
    l1: { signer: l1LDOHolder },
  } = network.getMultichainNetwork("optimism", "testnet", ldo_holder_pk);

  return {
    depositAmount: wei`0.025 ether`,
    withdrawalAmount: wei`0.025 ether`,
    gasAmount: wei`0.1 ether`, 
    l1Tester,
    l1LDOHolder,
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
    l2ERC20TokenBridge: L2ERC20TokenBridge__factory.connect(
      E2E_TEST_CONTRACTS.l2.l2ERC20TokenBridge,
      l2Tester
    ),
    crossChainMessenger: new CrossChainMessenger({
      l1SignerOrProvider: l1Tester,
      l2SignerOrProvider: l2Tester,
      l1ChainId: 42
    }),
    voting: Voting__factory.connect(
      E2E_TEST_CONTRACTS.l1.aragonVoting,
      l1LDOHolder
    ),
    govBridgeExecutor: GovBridgeExecutor__factory.connect(
      E2E_TEST_CONTRACTS.l2.govBridgeExecutor,
      l2Tester
    ),
    l1LDOToken: ERC20Mintable__factory.connect(
      E2E_TEST_CONTRACTS.l1.l1LDOToken,
      l1LDOHolder
    )
  };
}
