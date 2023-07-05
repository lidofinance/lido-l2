import * as hre from "hardhat";
import { scenario } from "../../../../utils/testing";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet, ethers } from "ethers";
import { Provider, Wallet as ZkWallet, utils } from "zksync-web3";
import { assert } from "chai";
import {
  L1ERC20Bridge__factory,
  L1Executor__factory,
  AragonAgentMock__factory,
  ERC20Token__factory,
} from "../../typechain";
import {
  ERC20BridgedUpgradeable__factory,
  L2ERC20Bridge__factory,
  ZkSyncBridgeExecutorUpgradable__factory,
} from "../../../l2/typechain";
import { ZKSYNC_ADDRESSES } from "./e2e";
import { richWallet } from "../../scripts/utils/rich_wallet";
import { parseEther } from "ethers/lib/utils";

const ETH_CLIENT_WEB3_URL = process.env.ETH_CLIENT_WEB3_URL || "";
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL || "";

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
    "Set allowance for L1ERC20Bridge to deposit",
    async ({ l1, depositAmount }) => {
      const { l1Token, accounts, l1Bridge } = l1;

      const allowanceTxResponse = await l1Token.approve(
        l1Bridge.address,
        depositAmount.mul(2)
      );

      await allowanceTxResponse.wait();

      const l1BridgeAllowanceAfter = await l1Token.allowance(
        accounts.deployer.address,
        l1Bridge.address
      );

      assert.equalBN(l1BridgeAllowanceAfter, depositAmount.mul(2));
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

      assert.isTrue(await l1Bridge.isDepositsEnabled());
      assert.isTrue(await l2Bridge.isDepositsEnabled());

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
        ethers.BigNumber.from(10_000_000),
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

      // total supply of L2 token should increase
      assert.equalBN(
        l2TokenTotalSupplyAfter.sub(l2TokenTotalSupplyBefore),
        depositAmount
      );

      // L1 token balance owned by bridge should increase
      assert.equalBN(
        l1ERC20BridgeTokenBalanceAfter.sub(l1ERC20BridgeTokenBalanceBefore),
        depositAmount
      );
      // L1 token balance owned by user should decrease
      assert.equalBN(
        userL1TokenBalanceBefore.sub(userL1TokenBalanceAfter),
        depositAmount
      );

      // L2 token balance owned by user should increase
      assert.equalBN(
        userL2TokenBalanceBefore.add(depositAmount),
        userL2TokenBalanceAfter
      );
    }
  )
  .step(
    "Withdraw tokens from L2 via L2ERC20Bridge",
    async ({ l1, l2, withdrawalAmount, zkProvider, ethProvider, gasLimit }) => {
      const { l1Token, l1Bridge, accounts } = l1;
      const { l2Token, l2Bridge } = l2;
      const walletAddress = accounts.deployer.address;
      const IL1Bridge = L1ERC20Bridge__factory.createInterface();

      assert.isTrue(await l1Bridge.isWithdrawalsEnabled());
      assert.isTrue(await l2Bridge.isWithdrawalsEnabled());

      const l1ERC20BridgeTokenBalanceBefore = await l1Token.balanceOf(
        l1Bridge.address
      );
      const l2TokenTotalSupplyBefore = await l2Token.totalSupply();
      const userL1TokenBalanceBefore = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceBefore = await l2Token.balanceOf(walletAddress);

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
      const message = ethers.utils.solidityPack(
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
        ethers.utils.keccak256(message)
      );

      const finalizeWithdrawResponse = await l1Bridge.finalizeWithdrawal(
        l1BatchNumber,
        messageProof?.id,
        l1BatchTxIndex,
        message,
        messageProof?.proof,
        { gasLimit }
      );
      await finalizeWithdrawResponse.wait();

      const l2TokenTotalSupplyAfter = await l2Token.totalSupply();
      const l1ERC20BridgeTokenBalanceAfter = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1TokenBalanceAfter = await l1Token.balanceOf(walletAddress);
      const userL2TokenBalanceAfter = await l2Token.balanceOf(walletAddress);

      // total supply of L2 token should decrease
      assert.equalBN(
        l2TokenTotalSupplyBefore.sub(l2TokenTotalSupplyAfter),
        withdrawalAmount
      );

      // L1 token balance owned by bridge should decrease
      assert.equalBN(
        l1ERC20BridgeTokenBalanceBefore.sub(l1ERC20BridgeTokenBalanceAfter),
        withdrawalAmount
      );

      // L1 token balance owned by user should increase
      assert.equalBN(
        userL1TokenBalanceAfter.sub(userL1TokenBalanceBefore),
        withdrawalAmount
      );

      // L2 token balance owned by user should decrease
      assert.equalBN(
        userL2TokenBalanceBefore.sub(userL2TokenBalanceAfter),
        withdrawalAmount
      );
    }
  )
  .run();

async function ctxFactory() {
  const { l1, l2 } = ZKSYNC_ADDRESSES;

  const zkProvider = new Provider(ZK_CLIENT_WEB3_URL);
  const ethProvider = new JsonRpcProvider(ETH_CLIENT_WEB3_URL);

  const ethDeployer = new Wallet(richWallet[0].privateKey, ethProvider);
  const ethGovernor = new Wallet(richWallet[1].privateKey, ethProvider);

  const deployer = new ZkWallet(richWallet[0].privateKey, zkProvider);
  const governor = new ZkWallet(richWallet[1].privateKey, zkProvider);

  return {
    l1: {
      l1Token: new ERC20Token__factory(ethDeployer).attach(l1.l1Token),
      l1Bridge: new L1ERC20Bridge__factory(ethDeployer).attach(l1.l1Bridge),
      l1Executor: new L1Executor__factory(ethDeployer).attach(l1.l1Executor),
      agent: new AragonAgentMock__factory(ethDeployer).attach(l1.agent),
      accounts: {
        deployer: ethDeployer,
        governor: ethGovernor,
      },
    },
    l2: {
      l2Token: new ERC20BridgedUpgradeable__factory(deployer).attach(
        l2.l2Token
      ),
      l2Bridge: new L2ERC20Bridge__factory(deployer).attach(l2.l2Bridge),
      govExecutor: new ZkSyncBridgeExecutorUpgradable__factory(deployer).attach(
        l2.govExecutor
      ),
      accounts: {
        deployer,
        governor,
      },
    },
    zkProvider,
    ethProvider,
    depositAmount: parseEther("0.025"),
    withdrawalAmount: parseEther("0.025"),
    gasLimit: 10_000_000,
  };
}
