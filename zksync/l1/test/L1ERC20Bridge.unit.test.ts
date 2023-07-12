import hre, { ethers } from "hardhat";
import { wei } from "../../../utils/wei";
import { unit } from "../../../utils/testing";
import { assert, expect } from "chai";
import * as path from "path";
import {
  L1ERC20Bridge__factory,
  L1ERC20Bridge,
  ZkSyncStub__factory,
} from "../typechain";
import {
  EmptyContractStub__factory,
  ERC20BridgedStub__factory,
  OssifiableProxy__factory,
} from "../../../typechain";
import { L2ERC20BridgeStub__factory } from "../../l2/typechain";
import { readBytecode } from "../scripts/utils/utils";

// zksync/l2/artifacts-zk/l2/contracts
const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../..", "l2"),
  "artifacts-zk/l2/contracts"
);

const L2_LIDO_BRIDGE_PROXY_BYTECODE = readBytecode(
  path.join(l2ArtifactsPath, "proxy"),
  "OssifiableProxy"
);

const L2_LIDO_BRIDGE_STUB_BYTECODE = readBytecode(
  path.join(l2ArtifactsPath, "stubs"),
  "L2ERC20BridgeStub"
);

const L1_TOKEN_STUB_NAME = "ERC20 Mock";
const L1_TOKEN_STUB_SYMBOL = "ERC20";
const L1_TOKEN_STUB_DECIMALS = "18";

unit("ZkSync :: L1ERC20Bridge", ctxFactory)
  .test("zkSync()", async (ctx) => {
    assert.equal(await ctx.l1Erc20Bridge.zkSync(), ctx.stubs.zkSync.address);
  })

  .test("l1Token()", async (ctx) => {
    assert.equal(await ctx.l1Erc20Bridge.l1Token(), ctx.stubs.l1Token.address);
  })

  .test("l2Token()", async (ctx) => {
    assert.equal(await ctx.l1Erc20Bridge.l2Token(), ctx.stubs.l2Token.address);
  })

  .test("l2Bridge()", async (ctx) => {
    assert.equal(
      await ctx.l1Erc20Bridge.l2Bridge(),
      ctx.stubs.l2Erc20Bridge.address
    );
  })

  .test("l2TokenAddress() :: correct l1Token", async (ctx) => {
    const actualL2TokenAddress = await ctx.l1Erc20Bridge.l2TokenAddress(
      ctx.stubs.l1Token.address
    );

    assert.equal(actualL2TokenAddress, ctx.stubs.l2Token.address);
  })

  .test("l2TokenAddress() :: incorrect l1Token", async (ctx) => {
    const actualL2TokenAddress = await ctx.l1Erc20Bridge.l2TokenAddress(
      ctx.accounts.stranger.address
    );

    assert.equal(actualL2TokenAddress, hre.ethers.constants.AddressZero);
  })

  .test("deposit() :: deposits disabled", async (ctx) => {
    // validate deposits are disabled
    assert.isFalse(await ctx.l1Erc20Bridge.isDepositsEnabled());

    const { sender, recipient } = ctx.accounts;
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    await expect(
      ctx.l1Erc20Bridge[
        "deposit(address,address,uint256,uint256,uint256,address)"
      ](
        recipient.address,
        ctx.stubs.l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address
      )
    ).to.be.revertedWith("ErrorDepositsDisabled");
  })

  .test("deposit() :: wrong l1Token address", async (ctx) => {
    const {
      accounts: { deployer, sender, recipient, stranger: wrongL1Token },
      l1Erc20Bridge,
    } = ctx;
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    await enableDepositsWithAssertions(
      l1Erc20Bridge,
      deployer.address,
      deployer.address
    );

    await expect(
      l1Erc20Bridge["deposit(address,address,uint256,uint256,uint256,address)"](
        recipient.address,
        wrongL1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address
      )
    ).to.be.revertedWith("ErrorUnsupportedL1Token");
  })

  .test("deposit() :: wrong (zero) deposit amount", async (ctx) => {
    const {
      accounts: { deployer, sender, recipient },
      l1Erc20Bridge,
    } = ctx;
    const wrongAmount = "0";
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    await enableDepositsWithAssertions(
      l1Erc20Bridge,
      deployer.address,
      deployer.address
    );

    await expect(
      l1Erc20Bridge["deposit(address,address,uint256,uint256,uint256,address)"](
        recipient.address,
        ctx.stubs.l1Token.address,
        wrongAmount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address
      )
    ).to.be.revertedWith("The deposit amount can't be zero");
  })

  .test("deposit() :: insufficient token allowance for bridge", async (ctx) => {
    const {
      accounts: { deployer, sender, recipient },
      l1Erc20Bridge,
    } = ctx;
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    await enableDepositsWithAssertions(
      l1Erc20Bridge,
      deployer.address,
      deployer.address
    );

    await expect(
      l1Erc20Bridge["deposit(address,address,uint256,uint256,uint256,address)"](
        recipient.address,
        ctx.stubs.l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address
      )
    ).to.be.revertedWith("ERC20: insufficient allowance");
  })

  .test("deposit() :: works as expected", async (ctx) => {
    const {
      accounts: { deployer, sender, recipient },
      stubs: { zkSync, l2Erc20Bridge, l1Token },
      l1Erc20Bridge,
    } = ctx;
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;
    const value = wei`250_000 gwei`;

    await enableDepositsWithAssertions(
      l1Erc20Bridge,
      deployer.address,
      deployer.address
    );

    const senderBalanceBefore = await l1Token.balanceOf(sender.address);
    const bridgeBalanceBefore = await l1Token.balanceOf(l1Erc20Bridge.address);

    // set allowance to L1 bridge
    await l1Token.connect(sender)["approve"](l1Erc20Bridge.address, amount);

    // validate token allowance for bridge
    const l1TokenAllowance = await l1Token.allowance(
      sender.address,
      l1Erc20Bridge.address
    );

    expect(
      l1TokenAllowance.eq(amount),
      `Value ${l1TokenAllowance.toString()} is not equal to ${amount.toString()}`
    );

    // set canonicalTxHash
    const canonicalTxHash = ethers.utils.formatBytes32String("canonicalTxHash");
    await zkSync.setCanonicalTxHash(canonicalTxHash);

    assert.equal(await zkSync.canonicalTxHash(), canonicalTxHash);

    const depositTx = await l1Erc20Bridge
      .connect(sender)
      ["deposit(address,address,uint256,uint256,uint256,address)"](
        recipient.address,
        l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        { value }
      );

    const abiCoder = ethers.utils.defaultAbiCoder;

    const gettersData = abiCoder.encode(
      ["bytes", "bytes", "bytes"],
      [
        abiCoder.encode(["string"], [L1_TOKEN_STUB_NAME]),
        abiCoder.encode(["string"], [L1_TOKEN_STUB_SYMBOL]),
        abiCoder.encode(["uint8"], [L1_TOKEN_STUB_DECIMALS]),
      ]
    );
    const txCalldata = l2Erc20Bridge.interface.encodeFunctionData(
      "finalizeDeposit",
      [sender.address, recipient.address, l1Token.address, amount, gettersData]
    );

    const l1BridgeDepositAmount = await l1Erc20Bridge.depositAmount(
      sender.address,
      l1Token.address,
      canonicalTxHash
    );

    // validate depositAmount used to claim funds in case the deposit transaction will fail
    expect(
      l1BridgeDepositAmount.eq(amount),
      `Value ${l1BridgeDepositAmount.toString()} is not equal to ${amount.toString()}`
    );

    // validate DepositInitiated event is emitted with the expected data
    await expect(depositTx)
      .to.emit(l1Erc20Bridge, "DepositInitiated")
      .withArgs(
        canonicalTxHash,
        sender.address,
        recipient.address,
        l1Token.address,
        amount
      );

    // validate RequestL2TransactionCalled event is emitted with the expected data
    await expect(depositTx)
      .to.emit(zkSync, "RequestL2TransactionCalled")
      .withArgs(
        value,
        l2Erc20Bridge.address,
        0,
        txCalldata,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        [],
        sender.address
      );

    const senderL1TokenBalance = await l1Token.balanceOf(sender.address);
    const bridgeL1TokenBalance = await l1Token.balanceOf(l1Erc20Bridge.address);

    // validate balance of the sender decreased
    expect(
      senderL1TokenBalance.eq(senderBalanceBefore.sub(amount)),
      `Value ${senderL1TokenBalance.toString()} is not equal to ${senderBalanceBefore
        .sub(amount)
        .toString()}`
    );

    // validate balance of the L1 bridge increased
    expect(
      bridgeL1TokenBalance.eq(bridgeBalanceBefore.add(amount)),
      `Value ${bridgeL1TokenBalance.toString()} is not equal to ${bridgeBalanceBefore
        .add(amount)
        .toString()}`
    );
  })

  .test("finalizeWithdrawal() :: withdrawals disabled", async (ctx) => {
    const { l1Erc20Bridge } = ctx;

    // validate withdrawals are disabled
    assert.isFalse(await l1Erc20Bridge.isWithdrawalsEnabled());

    const l2BlockNumber = ethers.BigNumber.from("1");
    const l2MessageIndex = ethers.BigNumber.from("1");
    const l2TxNumberInBlock = 1;
    const withdrawMessage = ethers.utils.defaultAbiCoder.encode(
      ["string"],
      ["message"]
    );
    const merkleProof = [
      ethers.utils.formatBytes32String("proof1"),
      ethers.utils.formatBytes32String("proof2"),
    ];

    await expect(
      l1Erc20Bridge.finalizeWithdrawal(
        l2BlockNumber,
        l2MessageIndex,
        l2TxNumberInBlock,
        withdrawMessage,
        merkleProof
      )
    ).to.be.revertedWith("ErrorWithdrawalsDisabled");

    // await assert.revertsWith(
    //   l1Erc20Bridge.finalizeWithdrawal(
    //     l2BlockNumber,
    //     l2MessageIndex,
    //     l2TxNumberInBlock,
    //     withdrawMessage,
    //     merkleProof
    //   ),
    //   "ErrorWithdrawalsDisabled"
    // );
  })

  .test(
    "finalizeWithdrawal() :: not enough ETH locked on L1 bridge",
    async (ctx) => {
      const {
        accounts: { deployer, recipient },
        stubs: { l1Token },
        l1Erc20Bridge,
      } = ctx;

      await enableWithdrawalsWithAssertions(
        l1Erc20Bridge,
        deployer.address,
        deployer.address
      );

      const amount = wei`1 ether`;

      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      const l1Erc20BridgeInterface = l1Erc20Bridge.interface;
      const withdrawMessage = ethers.utils.solidityPack(
        ["bytes4", "address", "address", "uint256"],
        [
          l1Erc20BridgeInterface.getSighash(
            l1Erc20BridgeInterface.getFunction("finalizeWithdrawal")
          ),
          recipient.address,
          l1Token.address,
          amount,
        ]
      );

      await expect(
        l1Erc20Bridge.finalizeWithdrawal(
          l2BlockNumber,
          l2MessageIndex,
          l2TxNumberInBlock,
          withdrawMessage,
          merkleProof
        )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    }
  )

  .test(
    "finalizeWithdrawal() :: works as expected (called by stranger)",
    async (ctx) => {
      const {
        accounts: { deployer, recipient, stranger },
        stubs: { l1Token },
        l1Erc20Bridge,
      } = ctx;

      await enableWithdrawalsWithAssertions(
        l1Erc20Bridge,
        deployer.address,
        deployer.address
      );

      const amount = wei`1 ether`;

      const recipientBalanceBefore = await l1Token.balanceOf(recipient.address);
      // transfer tokens to L1 bridge to simulate locked funds
      await l1Token.transfer(l1Erc20Bridge.address, amount);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      const l1Erc20BridgeInterface = l1Erc20Bridge.interface;
      const withdrawMessage = ethers.utils.solidityPack(
        ["bytes4", "address", "address", "uint256"],
        [
          l1Erc20BridgeInterface.getSighash(
            l1Erc20BridgeInterface.getFunction("finalizeWithdrawal")
          ),
          recipient.address,
          l1Token.address,
          amount,
        ]
      );

      const finalizeWithdrawalTx = await l1Erc20Bridge
        .connect(stranger)
        .finalizeWithdrawal(
          l2BlockNumber,
          l2MessageIndex,
          l2TxNumberInBlock,
          withdrawMessage,
          merkleProof
        );

      // validate withdrawal marked as finalized
      assert.isTrue(
        await l1Erc20Bridge.isWithdrawalFinalized(l2BlockNumber, l2MessageIndex)
      );

      // validate WithdrawalFinalized event is emitted with the expected data
      await expect(finalizeWithdrawalTx)
        .to.emit(l1Erc20Bridge, "WithdrawalFinalized")
        .withArgs(recipient.address, l1Token.address, amount);

      const recipientL1TokenBalance = await l1Token.balanceOf(
        recipient.address
      );
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // validate balance of the recipient increased
      expect(
        recipientL1TokenBalance.eq(recipientBalanceBefore.add(amount)),
        `Value ${recipientL1TokenBalance.toString()} is not equal to ${recipientBalanceBefore
          .add(amount)
          .toString()}`
      );

      expect(
        bridgeL1TokenBalance.eq(bridgeBalanceBefore.sub(amount)),
        `Value ${bridgeL1TokenBalance.toString()} is not equal to ${bridgeBalanceBefore
          .sub(amount)
          .toString()}`
      );
    }
  )

  .test("claimFailedDeposit() :: nothing to claim", async (ctx) => {
    const {
      accounts: { sender },
      stubs: { l1Token },
      l1Erc20Bridge,
    } = ctx;

    const txHash = ethers.utils.formatBytes32String("txHash");
    const l2BlockNumber = ethers.BigNumber.from("1");
    const l2MessageIndex = ethers.BigNumber.from("1");
    const l2TxNumberInBlock = 1;
    const merkleProof = [
      ethers.utils.formatBytes32String("proof1"),
      ethers.utils.formatBytes32String("proof2"),
    ];

    await expect(
      l1Erc20Bridge.claimFailedDeposit(
        sender.address,
        l1Token.address,
        txHash,
        l2BlockNumber,
        l2MessageIndex,
        l2TxNumberInBlock,
        merkleProof
      )
    ).to.be.revertedWith("The claimed amount can't be zero");
  })

  .test("claimFailedDeposit() :: works us expected", async (ctx) => {
    const {
      accounts: { deployer, sender, recipient },
      stubs: { zkSync, l1Token },
      l1Erc20Bridge,
    } = ctx;
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;
    const value = wei`250_000 gwei`;

    await enableDepositsWithAssertions(
      l1Erc20Bridge,
      deployer.address,
      deployer.address
    );

    await l1Token.connect(sender)["approve"](l1Erc20Bridge.address, amount);

    const canonicalTxHash = ethers.utils.formatBytes32String("canonicalTxHash");
    await zkSync.setCanonicalTxHash(canonicalTxHash);

    const l2BlockNumber = ethers.BigNumber.from("1");
    const l2MessageIndex = ethers.BigNumber.from("1");
    const l2TxNumberInBlock = 1;
    const merkleProof = [
      ethers.utils.formatBytes32String("proof1"),
      ethers.utils.formatBytes32String("proof2"),
    ];

    const senderBalanceBeforeDeposit = await l1Token.balanceOf(sender.address);
    const bridgeBalanceBeforeDeposit = await l1Token.balanceOf(
      l1Erc20Bridge.address
    );

    const depositTx = await l1Erc20Bridge
      .connect(sender)
      ["deposit(address,address,uint256,uint256,uint256,address)"](
        recipient.address,
        l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        { value }
      );
    await depositTx.wait();

    const senderBalanceAfterDeposit = await l1Token.balanceOf(sender.address);
    const bridgeBalanceAfterDeposit = await l1Token.balanceOf(
      l1Erc20Bridge.address
    );

    // validate balance of the sender decreased after deposit
    expect(
      senderBalanceAfterDeposit.eq(senderBalanceBeforeDeposit.sub(amount)),
      `Value ${senderBalanceAfterDeposit.toString()} is not equal to ${senderBalanceBeforeDeposit
        .sub(amount)
        .toString()}`
    );

    // validate balance of the bridge increased after deposit
    expect(
      bridgeBalanceAfterDeposit.eq(bridgeBalanceBeforeDeposit.add(amount)),
      `Value ${bridgeBalanceAfterDeposit.toString()} is not equal to ${bridgeBalanceBeforeDeposit
        .add(amount)
        .toString()}`
    );

    const claimFailedDepositTx = await l1Erc20Bridge.claimFailedDeposit(
      sender.address,
      l1Token.address,
      canonicalTxHash,
      l2BlockNumber,
      l2MessageIndex,
      l2TxNumberInBlock,
      merkleProof
    );

    await expect(claimFailedDepositTx)
      .to.emit(l1Erc20Bridge, "ClaimedFailedDeposit")
      .withArgs(sender.address, l1Token.address, amount);

    const senderBalanceAfterClaimFailedDeposit = await l1Token.balanceOf(
      sender.address
    );
    const bridgeBalanceAfterClaimFailedDeposit = await l1Token.balanceOf(
      l1Erc20Bridge.address
    );

    // validate balance of the sender increased after claiming failed deposit
    expect(
      senderBalanceAfterClaimFailedDeposit.eq(
        senderBalanceAfterDeposit.add(amount)
      ),
      `Value ${senderBalanceAfterClaimFailedDeposit.toString()} is not equal to ${senderBalanceAfterDeposit
        .add(amount)
        .toString()}`
    );

    // validate balance of the bridge decreased after claiming failed deposit
    expect(
      bridgeBalanceAfterClaimFailedDeposit.eq(
        bridgeBalanceAfterDeposit.sub(amount)
      ),
      `Value ${bridgeBalanceAfterClaimFailedDeposit.toString()} is not equal to ${bridgeBalanceAfterDeposit
        .sub(amount)
        .toString()}`
    );
  })

  .run();

async function enableDepositsWithAssertions(
  l1Erc20Bridge: L1ERC20Bridge,
  defaultAdminAddress: string,
  depositEnablerAddress: string
) {
  // validate that contract is not initialized and deposits are disabled
  assert.isFalse(await l1Erc20Bridge.isInitialized());
  assert.isFalse(await l1Erc20Bridge.isDepositsEnabled());

  // grant DEFAULT_ADMIN_ROLE role
  await l1Erc20Bridge["initialize(address)"](defaultAdminAddress);

  assert.isTrue(await l1Erc20Bridge.isInitialized());

  // grant DEPOSITS_ENABLER_ROLE role
  await l1Erc20Bridge.grantRole(
    await l1Erc20Bridge.DEPOSITS_ENABLER_ROLE(),
    depositEnablerAddress
  );

  await l1Erc20Bridge.enableDeposits();

  assert.isTrue(await l1Erc20Bridge.isDepositsEnabled());
}

async function enableWithdrawalsWithAssertions(
  l1Erc20Bridge: L1ERC20Bridge,
  defaultAdminAddress: string,
  withdrawalEnablerAddress: string
) {
  // validate that contract is not initialized and withdrawals are disabled
  assert.isFalse(await l1Erc20Bridge.isInitialized());
  assert.isFalse(await l1Erc20Bridge.isWithdrawalsEnabled());

  // grant DEFAULT_ADMIN_ROLE role
  await l1Erc20Bridge["initialize(address)"](defaultAdminAddress);

  assert.isTrue(await l1Erc20Bridge.isInitialized());

  // grant WITHDRAWALS_ENABLER_ROLE role
  await l1Erc20Bridge.grantRole(
    await l1Erc20Bridge.WITHDRAWALS_ENABLER_ROLE(),
    withdrawalEnablerAddress
  );

  await l1Erc20Bridge.enableWithdrawals();

  assert.isTrue(await l1Erc20Bridge.isWithdrawalsEnabled());
}

async function ctxFactory() {
  const [deployer, governor, sender, recipient, stranger] =
    await hre.ethers.getSigners();

  const zkSyncStub = await new ZkSyncStub__factory(deployer).deploy();

  const l2TokenStub = await new EmptyContractStub__factory(deployer).deploy();
  const l1TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
    L1_TOKEN_STUB_NAME,
    L1_TOKEN_STUB_SYMBOL
  );
  await l1TokenStub.transfer(sender.address, wei`100 ether`);

  const l1Erc20BridgeImpl = await new L1ERC20Bridge__factory(deployer).deploy(
    zkSyncStub.address
  );

  const requiredValueToInitializeBridge =
    await zkSyncStub.l2TransactionBaseCost(0, 0, 0);

  const l1Erc20BridgeProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(l1Erc20BridgeImpl.address, governor.address, "0x");

  const l1Erc20Bridge = L1ERC20Bridge__factory.connect(
    l1Erc20BridgeProxy.address,
    deployer
  );

  const initTx = await l1Erc20Bridge[
    "initialize(bytes[],address,address,address,uint256,uint256)"
  ](
    [L2_LIDO_BRIDGE_STUB_BYTECODE, L2_LIDO_BRIDGE_PROXY_BYTECODE],
    l1TokenStub.address,
    l2TokenStub.address,
    governor.address,
    requiredValueToInitializeBridge,
    requiredValueToInitializeBridge
  );

  await initTx.wait();

  return {
    accounts: {
      deployer,
      governor,
      sender,
      recipient,
      stranger,
    },
    stubs: {
      zkSync: zkSyncStub,
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l2Erc20Bridge: L2ERC20BridgeStub__factory.connect(
        await l1Erc20Bridge.l2Bridge(),
        deployer
      ),
    },
    l1Erc20Bridge,
  };
}
