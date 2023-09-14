import * as hre from "hardhat";
import { scenario } from "../../../../utils/testing";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet, Contract, BigNumberish, BigNumber } from "ethers";
import { Provider, Wallet as ZkWallet, utils } from "zksync-web3";
import { assert, expect } from "chai";
import {
  L1ERC20Bridge__factory,
  L1Executor__factory,
  AragonAgentMock__factory,
  ERC20Token__factory,
} from "../../typechain";
import {
  ERC20BridgedUpgradeable__factory,
  L2ERC20Bridge__factory,
  ZkSyncBridgeExecutor__factory,
} from "../../../l2/typechain";
import { ZKSYNC_ADDRESSES } from "./e2e";
import { richWallet } from "../../scripts/utils/rich_wallet";
import { keccak256, parseEther, solidityPack } from "ethers/lib/utils";
import { IZkSyncFactory } from "zksync-web3/build/typechain";

const ETH_CLIENT_WEB3_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;
const CONTRACTS_DIAMOND_PROXY_ADDR = process.env
  .CONTRACTS_DIAMOND_PROXY_ADDR as string;

scenario("Bridge E2E Testing", ctxFactory)
  .step(
    "Validate L1 & L2 Bridges are initiated properly",
    async ({ l1, l2 }) => {
      const { l1Bridge, l1Token } = l1;
      const { l2Bridge, l2Token } = l2;

      assert((await l1Bridge.l1Token()) === l1Token.address);
      assert((await l1Bridge.l2Token()) === l2Token.address);
      assert((await l1Bridge.l2Bridge()) === l2Bridge.address);
      assert.isTrue(await l1Bridge.isInitialized());

      assert((await l2Bridge.l1Token()) === l1Token.address);
      assert((await l2Bridge.l2Token()) === l2Token.address);
      assert((await l2Bridge.l1Bridge()) === l1Bridge.address);
      assert.isTrue(await l2Bridge.isInitialized());
    }
  )

  .step(
    "Validate tester has required amount of L1 token",
    async ({ l1, depositAmount }) => {
      const { l1Token, accounts } = l1;

      const walletAddress = accounts.deployer.address;

      const userL1TokenBalanceBefore = await l1Token.balanceOf(walletAddress);

      if (userL1TokenBalanceBefore.lt(depositAmount)) {
        const tokenMintResponse = await l1Token.mint(
          walletAddress,
          depositAmount
        );
        await tokenMintResponse.wait();
      }
      const userL1TokenBalanceAfter = await l1Token.balanceOf(walletAddress);

      assert(userL1TokenBalanceAfter.gte(depositAmount));
    }
  )

  .step(
    "Set allowance for L1ERC20Bridge to deposit",
    async ({ l1, depositAmount }) => {
      const { l1Token, accounts, l1Bridge } = l1;

      const allowanceTxResponse = await l1Token.approve(
        l1Bridge.address,
        depositAmount
      );

      await allowanceTxResponse.wait();

      const l1BridgeAllowanceAfter = await l1Token.allowance(
        accounts.deployer.address,
        l1Bridge.address
      );

      expect(
        l1BridgeAllowanceAfter.eq(depositAmount),
        `Value ${l1BridgeAllowanceAfter.toString()} is not equal to ${depositAmount.toString()}`
      );
    }
  )

  .step(
    "L1 Agent can disable/enable deposits on L1 & L2 bridges",
    async (ctx) => {
      const {
        l1: { l1Bridge, agent },
        l2: { l2Bridge },
      } = ctx;

      /**
       * L1
       */
      if (await l1Bridge.isDepositsEnabled()) {
        await executeGovOnL1Bridge(
          l1Bridge,
          agent,
          BRIDGE_ACTIONS.disableDeposits
        );
        assert.isFalse(await l1Bridge.isDepositsEnabled());
      }

      if (!(await l1Bridge.isDepositsEnabled())) {
        await executeGovOnL1Bridge(
          l1Bridge,
          agent,
          BRIDGE_ACTIONS.enableDeposits
        );
        assert.isTrue(await l1Bridge.isDepositsEnabled());
      }
      /**
       * L2
       */
      if (await l2Bridge.isDepositsEnabled()) {
        await executeGovOnL2Bridge(
          l2Bridge,
          agent,
          BRIDGE_ACTIONS.disableDeposits,
          ctx
        );
        assert.isFalse(
          await l2Bridge.isDepositsEnabled(),
          "Deposits should be disabled"
        );
      }
      if (!(await l2Bridge.isDepositsEnabled())) {
        await executeGovOnL2Bridge(
          l2Bridge,
          agent,
          BRIDGE_ACTIONS.enableDeposits,
          ctx
        );
        assert.isTrue(
          await l2Bridge.isDepositsEnabled(),
          "Deposits should be enabled"
        );
      }
    }
  )
  .step(
    "L1 Agent can disable/enable withdrawals on L1 & L2 bridges",
    async (ctx) => {
      const {
        l1: { l1Bridge, agent },
        l2: { l2Bridge },
      } = ctx;

      /**
       * L1
       */
      if (await l1Bridge.isWithdrawalsEnabled()) {
        await executeGovOnL1Bridge(
          l1Bridge,
          agent,
          BRIDGE_ACTIONS.disableWithdrawals
        );

        assert.isFalse(
          await l1Bridge.isWithdrawalsEnabled(),
          "L1 Withdrawals should be disabled"
        );
      }

      if (!(await l1Bridge.isWithdrawalsEnabled())) {
        await executeGovOnL1Bridge(
          l1Bridge,
          agent,
          BRIDGE_ACTIONS.enableWithdrawals
        );
        assert.isTrue(
          await l1Bridge.isWithdrawalsEnabled(),
          "L1 Withdrawals should be enabled"
        );
      }

      /**
       * L2
       */
      if (await l2Bridge.isWithdrawalsEnabled()) {
        await executeGovOnL2Bridge(
          l2Bridge,
          agent,
          BRIDGE_ACTIONS.disableWithdrawals,
          ctx
        );
        assert.isFalse(
          await l2Bridge.isWithdrawalsEnabled(),
          "Withdrawals should be disabled"
        );
      }

      if (!(await l2Bridge.isWithdrawalsEnabled())) {
        await executeGovOnL2Bridge(
          l2Bridge,
          agent,
          BRIDGE_ACTIONS.enableWithdrawals,
          ctx
        );
        assert.isTrue(
          await l2Bridge.isWithdrawalsEnabled(),
          "Withdrawals should be enabled"
        );
      }
    }
  )

  .step(
    "Deposit tokens to L2 via L1ERC20Bridge",
    async ({ l1, l2, depositAmount, zkProvider, ethProvider, gasLimit }) => {
      const { l1Token, l1Bridge, accounts } = l1;
      const { l2Token, l2Bridge } = l2;

      const walletAddress = accounts.deployer.address;

      const zkWallet = new ZkWallet(
        richWallet[0].privateKey,
        zkProvider,
        ethProvider
      );

      assert.isTrue(
        await l1Bridge.isDepositsEnabled(),
        "L1 Deposits should be enabled"
      );
      assert.isTrue(
        await l2Bridge.isDepositsEnabled(),
        "L2 Deposits should be enabled"
      );

      const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
      const l1ERC20BridgeTokenBalanceBefore = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1TokenBalanceBefore = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceBefore = await l2Token.balanceOf(walletAddress);

      const depositTx = await l1Bridge.populateTransaction[
        "deposit(address,address,uint256,uint256,uint256,address)"
      ](
        walletAddress,
        l1Token.address,
        depositAmount,
        BigNumber.from(10_000_000),
        utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
        walletAddress
      );

      // call to RPC method zks_estimateGasL1ToL2 to estimate L2 gas limit
      const l2GasLimit = await zkProvider.estimateGasL1(depositTx);
      const l2GasPrice = await zkProvider.getGasPrice();

      const baseCost = await zkWallet.getBaseCost({
        gasLimit: l2GasLimit,
        gasPrice: l2GasPrice,
        gasPerPubdataByte: utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
      });

      const depositResponse = await l1Bridge[
        "deposit(address,address,uint256,uint256,uint256,address)"
      ](
        walletAddress,
        l1Token.address,
        depositAmount,
        l2GasLimit,
        utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
        walletAddress,
        {
          gasLimit,
          value: baseCost,
        }
      );

      await depositResponse.wait();

      const l2Response = await zkProvider.getL2TransactionFromPriorityOp(
        depositResponse
      );
      await l2Response.wait();

      const l2TokenTotalSupplyAfter = await l2Token.totalSupply();
      const l1ERC20BridgeTokenBalanceAfter = await l1Token.balanceOf(
        l1Bridge.address
      );

      const userL1TokenBalanceAfter = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceAfter = await l2Token.balanceOf(walletAddress);

      const l1TokenTotalSupplyDifference = l1ERC20BridgeTokenBalanceAfter.sub(
        l1ERC20BridgeTokenBalanceBefore
      );
      const l2TokenTotalSupplyDifference = l2TokenTotalSupplyAfter.sub(
        l2TokenTotalSupplyBefore
      );
      const l1TokenUserBalanceDifference = userL1TokenBalanceBefore.sub(
        userL1TokenBalanceAfter
      );
      const l2TokenUserBalanceDifference = userL2TokenBalanceAfter.sub(
        userL2TokenBalanceBefore
      );

      // total supply of L2 token should increase
      expect(
        l2TokenTotalSupplyDifference.eq(depositAmount),
        `Value ${l2TokenTotalSupplyDifference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L1 token balance owned by bridge should increase
      expect(
        l1TokenTotalSupplyDifference.eq(depositAmount),
        `Value ${l1TokenTotalSupplyDifference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L1 token balance owned by user should decrease
      expect(
        l1TokenUserBalanceDifference.eq(depositAmount),
        `Value ${l1TokenTotalSupplyDifference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L2 token balance owned by user should increase
      expect(
        l2TokenUserBalanceDifference.eq(depositAmount),
        `Value ${l1TokenTotalSupplyDifference.toString()} is not equal to ${depositAmount.toString()}`
      );
    }
  )
  .step(
    "Withdraw tokens from L2 via L2ERC20Bridge",
    async ({ l1, l2, withdrawalAmount, zkProvider, gasLimit }) => {
      const { l1Token, l1Bridge, accounts } = l1;
      const { l2Token, l2Bridge } = l2;
      const walletAddress = accounts.deployer.address;
      const IL1Bridge = L1ERC20Bridge__factory.createInterface();

      assert.isTrue(
        await l1Bridge.isWithdrawalsEnabled(),
        "L1 Withdrawals should be enabled"
      );
      console.log("L1 Withdrawals should be enabled");

      assert.isTrue(
        await l2Bridge.isWithdrawalsEnabled(),
        "L2 Withdrawals should be enabled"
      );
      console.log("L2 Withdrawals should be enabled");

      const l1ERC20BridgeTokenBalanceBefore = await l1Token.balanceOf(
        l1Bridge.address
      );
      const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
      const userL1TokenBalanceBefore = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceBefore = await l2Token.balanceOf(walletAddress);

      console.log(
        "userL1TokenBalanceBefore",
        userL2TokenBalanceBefore.toString()
      );
      console.log(
        "userL2TokenBalanceBefore",
        userL2TokenBalanceBefore.toString()
      );
      const withdrawResponse = await l2Bridge.withdraw(
        walletAddress,
        l2Token.address,
        withdrawalAmount,
        { gasLimit }
      );

      await withdrawResponse.wait();
      const { blockNumber, l1BatchNumber, l1BatchTxIndex } =
        await withdrawResponse.waitFinalize();

      // Finalize Withdrawal on L1
      const message = solidityPack(
        ["bytes4", "address", "address", "uint256"],
        [
          IL1Bridge.getSighash(IL1Bridge.getFunction("finalizeWithdrawal")),
          walletAddress,
          l1Token.address,
          withdrawalAmount,
        ]
      );

      const messageProof = await zkProvider.getMessageProof(
        blockNumber,
        l2Bridge.address,
        keccak256(message)
      );

      console.log("finalizeWithdrawal");
      const finalizeWithdrawResponse = await l1Bridge.finalizeWithdrawal(
        l1BatchNumber,
        messageProof?.id,
        l1BatchTxIndex,
        message,
        messageProof?.proof,
        { gasLimit }
      );
      console.log("finalizeWithdrawResponse.wait()");

      await finalizeWithdrawResponse.wait();

      const l2TokenTotalSupplyAfter = await l2Token.totalSupply();
      const l1ERC20BridgeTokenBalanceAfter = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1TokenBalanceAfter = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceAfter = await l2Token.balanceOf(walletAddress);

      const l1TokenTotalSupplyDifference = l2TokenTotalSupplyBefore.sub(
        l2TokenTotalSupplyAfter
      );
      const l1ERC20BridgeTokenBalanceDifference =
        l1ERC20BridgeTokenBalanceBefore.sub(l1ERC20BridgeTokenBalanceAfter);
      const l1TokenUserBalanceDifference = userL1TokenBalanceAfter.sub(
        userL1TokenBalanceBefore
      );
      const l2TokenUserBalanceDifference = userL2TokenBalanceBefore.sub(
        userL2TokenBalanceAfter
      );

      // total supply of L2 token should decrease
      expect(
        l1TokenTotalSupplyDifference.eq(withdrawalAmount),
        `Value ${l1TokenTotalSupplyDifference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L1 token balance owned by bridge should decrease
      expect(
        l1ERC20BridgeTokenBalanceDifference.eq(withdrawalAmount),
        `Value ${l1ERC20BridgeTokenBalanceDifference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L1 token balance owned by user should increase
      expect(
        l1TokenUserBalanceDifference.eq(withdrawalAmount),
        `Value ${l1TokenUserBalanceDifference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L2 token balance owned by user should decrease
      expect(
        l2TokenUserBalanceDifference.eq(withdrawalAmount),
        `Value ${l2TokenUserBalanceDifference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );
    }
  )

  .run();

async function ctxFactory() {
  const { l1, l2 } = ZKSYNC_ADDRESSES;

  const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);
  const ethProvider = new JsonRpcProvider(ETH_CLIENT_WEB3_URL);

  const ethDeployer = new Wallet(
    process.env.PRIVATE_KEY as string,
    ethProvider
  );
  const deployer = new ZkWallet(process.env.PRIVATE_KEY as string, zkProvider);

  return {
    l1: {
      l1Token: new ERC20Token__factory(ethDeployer).attach(l1.l1Token),
      l1Bridge: new L1ERC20Bridge__factory(ethDeployer).attach(l1.l1Bridge),
      l1Executor: new L1Executor__factory(ethDeployer).attach(l1.l1Executor),
      agent: new AragonAgentMock__factory(ethDeployer).attach(l1.agent),
      zkSync: IZkSyncFactory.connect(CONTRACTS_DIAMOND_PROXY_ADDR, ethDeployer),
      accounts: {
        deployer: ethDeployer,
      },
    },
    l2: {
      l2Token: new ERC20BridgedUpgradeable__factory(deployer).attach(
        l2.l2Token
      ),
      l2Bridge: new L2ERC20Bridge__factory(deployer).attach(l2.l2Bridge),
      govExecutor: new ZkSyncBridgeExecutor__factory(deployer).attach(
        l2.govExecutor
      ),
      accounts: {
        deployer,
      },
    },
    zkProvider,
    ethProvider,
    depositAmount: parseEther("0.025"),
    withdrawalAmount: parseEther("0.025"),
    gasLimit: 10_000_000,
  };
}

const BRIDGE_ACTIONS = {
  disableDeposits: "disableDeposits",
  enableDeposits: "enableDeposits",
  enableWithdrawals: "enableWithdrawals",
  disableWithdrawals: "disableWithdrawals",
} as const;

/**
 * executeGovOnL1Bridge
 * @param bridge
 * @param agent
 * @param type
 */
async function executeGovOnL1Bridge(
  bridge: Contract,
  agent: Contract,
  type: typeof BRIDGE_ACTIONS[keyof typeof BRIDGE_ACTIONS]
) {
  const IL1Bridge = L1ERC20Bridge__factory.createInterface();

  const data = IL1Bridge.encodeFunctionData(BRIDGE_ACTIONS[type] as string, []);
  const txResponse = await agent.execute(bridge.address, 0, data, {
    gasLimit: 10_000_000,
  });

  await txResponse.wait();
}

/**
 * executeGovOnL2Bridge
 * @param bridge
 * @param agent
 * @param type
 * @param ctx
 */
async function executeGovOnL2Bridge(
  bridge: Contract,
  agent: Contract,
  type: typeof BRIDGE_ACTIONS[keyof typeof BRIDGE_ACTIONS],
  ctx: Awaited<ReturnType<typeof ctxFactory>>
) {
  const { l1, l2, zkProvider, ethProvider } = ctx;

  const wallet = l1.accounts.deployer;
  const gasPrice = await ethProvider.getGasPrice();

  const ZkSyncBridgeExecutor = new ZkSyncBridgeExecutor__factory(
    l2.accounts.deployer
  ).attach(l2.govExecutor.address);

  const IZkSyncBridgeExecutorUpgradable = ZkSyncBridgeExecutor.interface;

  // encode data to be queued by ZkBridgeExecutor on L2
  const data = IZkSyncBridgeExecutorUpgradable.encodeFunctionData("queue", [
    [bridge.address],
    [hre.ethers.utils.parseEther("0")],
    [`${BRIDGE_ACTIONS[type]}()`],
    [new Uint8Array()],
  ]);

  // estimate gas to to bridge encoded from L1 to L2
  const gasLimit = await zkProvider.estimateL1ToL2Execute({
    contractAddress: l2.govExecutor.address,
    calldata: data,
    caller: utils.applyL1ToL2Alias(l1.l1Executor.address),
  });
  // estimate cons of L1 to L2 execution
  const baseCost = await l1.zkSync.l2TransactionBaseCost(
    gasPrice,
    gasLimit,
    utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
  );

  // if call exception change value
  const ethTransferResponse = await wallet.sendTransaction({
    to: l1.agent.address,
    value: baseCost,
  });
  await ethTransferResponse.wait();

  /**
   * Encode data which is sent to L1 Executor
   * * This data contains previously encoded queue data
   */
  const encodedDataQueue =
    L1Executor__factory.createInterface().encodeFunctionData("callZkSync", [
      l2.govExecutor.address,
      data,
      gasLimit,
      utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    ]);

  /**
   *  Sends Action set from L1 Executor to L2 Bridge Executor
   */
  const executeTx = await agent.execute(
    l1.l1Executor.address,
    baseCost,
    encodedDataQueue,
    { gasPrice, gasLimit: 10_000_000 }
  );

  const actionSetQueuedPromise = new Promise((resolve) => {
    ZkSyncBridgeExecutor.on("ActionsSetQueued", (actionSetId) => {
      resolve(actionSetId.toString());
      ZkSyncBridgeExecutor.removeAllListeners();
    });
  });

  await executeTx.wait();

  const actionSetId = await actionSetQueuedPromise.then((res) => res);
  const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
    executeTx
  );
  await l2Response2.wait();

  /**
   * Execute Action Set
   */
  const executeAction = await ZkSyncBridgeExecutor.execute(
    actionSetId as BigNumberish,
    {
      gasLimit: 10_000_000,
    }
  );

  await executeAction.wait();
}
