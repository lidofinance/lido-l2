import { assert } from "chai";
import hre from "hardhat";
import {
  ERC20Stub__factory,
  L1TokenBridge__factory,
  L2TokensBridge__factory,
  OssifiableProxy__factory,
  EmptyContractStub__factory,
} from "../../typechain";
import { CrossDomainMessengerStub__factory } from "../../typechain/factories/CrossDomainMessengerStub__factory";
import { testsuite } from "../../utils/testing";
import { wei } from "../../utils/wei";
import * as account from "../../utils/account";

testsuite("Optimism :: L1TokenBridge unit tests", ctxProvider, (ctx) => {
  it("l2TokenBridge()", async () => {
    assert.equal(
      await ctx.l1TokenBridge.l2TokenBridge(),
      ctx.accounts.l2TokenBridgeEOA.address
    );
  });

  it("depositERC20() :: deposits disabled", async () => {
    await ctx.l1TokenBridge.disableDeposits();

    assert.isFalse(await ctx.l1TokenBridge.isDepositsEnabled());

    await assert.revertsWith(
      ctx.l1TokenBridge.depositERC20(
        ctx.stubs.l1Token.address,
        ctx.stubs.l2Token.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorDepositsDisabled()"
    );
  });

  it("depositsERC20() :: wrong l1Token address", async () => {
    await assert.revertsWith(
      ctx.l1TokenBridge.depositERC20(
        ctx.accounts.stranger.address,
        ctx.stubs.l2Token.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorWrongL1Token()"
    );
  });

  it("depositsERC20() :: wrong l2Token address", async () => {
    await assert.revertsWith(
      ctx.l1TokenBridge.depositERC20(
        ctx.stubs.l1Token.address,
        ctx.accounts.stranger.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorWrongL2Token()"
    );
  });

  it("depositERC20() :: not from EOA", async () => {
    await assert.revertsWith(
      ctx.l1TokenBridge
        .connect(ctx.accounts.emptyContractAsEOA)
        .depositERC20(
          ctx.stubs.l1Token.address,
          ctx.stubs.l2Token.address,
          wei`1 ether`,
          wei`1 gwei`,
          "0x"
        ),
      "ErrorSenderNotEOA()"
    );
  });

  it("depositERC20()", async () => {
    const {
      l1TokenBridge,
      accounts: { deployer, l2TokenBridgeEOA },
      stubs: { l1Token, l2Token, l1Messenger },
    } = ctx;

    const l2Gas = wei`0.99 wei`;
    const amount = wei`1 ether`;
    const data = "0xdeadbeaf";

    await l1Token.approve(l1TokenBridge.address, amount);

    const deployerBalanceBefore = await l1Token.balanceOf(deployer.address);
    const bridgeBalanceBefore = await l1Token.balanceOf(l1TokenBridge.address);

    const tx = await l1TokenBridge.depositERC20(
      l1Token.address,
      l2Token.address,
      amount,
      l2Gas,
      data
    );

    await assert.emits(l1TokenBridge, tx, "ERC20DepositInitiated", [
      l1Token.address,
      l2Token.address,
      deployer.address,
      deployer.address,
      amount,
      data,
    ]);

    await assert.emits(l1Messenger, tx, "SentMessage", [
      l2TokenBridgeEOA.address,
      l1TokenBridge.address,
      L2TokensBridge__factory.createInterface().encodeFunctionData(
        "finalizeDeposit",
        [
          l1Token.address,
          l2Token.address,
          deployer.address,
          deployer.address,
          amount,
          data,
        ]
      ),
      1, // message nonce
      l2Gas,
    ]);

    assert.equalBN(
      await l1Token.balanceOf(deployer.address),
      deployerBalanceBefore.sub(amount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1TokenBridge.address),
      bridgeBalanceBefore.add(amount)
    );
  });

  it("depositERC20To() :: deposits disabled", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token, l2Token },
      accounts: { recipient },
    } = ctx;
    await l1TokenBridge.disableDeposits();

    assert.isFalse(await l1TokenBridge.isDepositsEnabled());

    await assert.revertsWith(
      l1TokenBridge.depositERC20To(
        l1Token.address,
        l2Token.address,
        recipient.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorDepositsDisabled()"
    );
  });

  it("depositsERC20To() :: wrong l1Token address", async () => {
    const {
      l1TokenBridge,
      stubs: { l2Token },
      accounts: { recipient, stranger },
    } = ctx;
    await l1TokenBridge.disableDeposits();

    assert.isFalse(await l1TokenBridge.isDepositsEnabled());

    await assert.revertsWith(
      l1TokenBridge.depositERC20To(
        stranger.address,
        l2Token.address,
        recipient.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorDepositsDisabled()"
    );
  });

  it("depositsERC20To() :: wrong l2Token address", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token },
      accounts: { recipient, stranger },
    } = ctx;
    await l1TokenBridge.disableDeposits();

    assert.isFalse(await l1TokenBridge.isDepositsEnabled());

    await assert.revertsWith(
      l1TokenBridge.depositERC20To(
        l1Token.address,
        stranger.address,
        recipient.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorDepositsDisabled()"
    );
  });

  it("depositERC20To()", async () => {
    const {
      l1TokenBridge,
      accounts: { deployer, l2TokenBridgeEOA, recipient },
      stubs: { l1Token, l2Token, l1Messenger },
    } = ctx;

    const l2Gas = wei`0.99 wei`;
    const amount = wei`1 ether`;
    const data = "0x";

    await l1Token.approve(l1TokenBridge.address, amount);

    const deployerBalanceBefore = await l1Token.balanceOf(deployer.address);
    const bridgeBalanceBefore = await l1Token.balanceOf(l1TokenBridge.address);

    const tx = await l1TokenBridge.depositERC20To(
      l1Token.address,
      l2Token.address,
      recipient.address,
      amount,
      l2Gas,
      data
    );

    await assert.emits(l1TokenBridge, tx, "ERC20DepositInitiated", [
      l1Token.address,
      l2Token.address,
      deployer.address,
      recipient.address,
      amount,
      data,
    ]);

    await assert.emits(l1Messenger, tx, "SentMessage", [
      l2TokenBridgeEOA.address,
      l1TokenBridge.address,
      L2TokensBridge__factory.createInterface().encodeFunctionData(
        "finalizeDeposit",
        [
          l1Token.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          amount,
          data,
        ]
      ),
      1, // message nonce
      l2Gas,
    ]);

    assert.equalBN(
      await l1Token.balanceOf(deployer.address),
      deployerBalanceBefore.sub(amount)
    );

    assert.equalBN(
      await l1Token.balanceOf(l1TokenBridge.address),
      bridgeBalanceBefore.add(amount)
    );
  });

  it("finalizeERC20Withdrawal() :: withdrawals are disabled", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token, l2Token },
      accounts: { deployer, recipient, l2TokenBridgeEOA },
    } = ctx;
    await l1TokenBridge.disableWithdrawals();

    assert.isFalse(await l1TokenBridge.isWithdrawalsEnabled());

    await assert.revertsWith(
      l1TokenBridge
        .connect(l2TokenBridgeEOA)
        .finalizeERC20Withdrawal(
          l1Token.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorWithdrawalsDisabled()"
    );
  });

  it("finalizeERC20Withdrawal() :: wrong l1Token", async () => {
    const {
      l1TokenBridge,
      stubs: { l2Token },
      accounts: { deployer, recipient, l2TokenBridgeEOA, stranger },
    } = ctx;

    await assert.revertsWith(
      l1TokenBridge
        .connect(l2TokenBridgeEOA)
        .finalizeERC20Withdrawal(
          stranger.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorWrongL1Token()"
    );
  });

  it("finalizeERC20Withdrawal() :: wrong l2Token", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token },
      accounts: { deployer, recipient, l2TokenBridgeEOA, stranger },
    } = ctx;

    await assert.revertsWith(
      l1TokenBridge
        .connect(l2TokenBridgeEOA)
        .finalizeERC20Withdrawal(
          l1Token.address,
          stranger.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorWrongL2Token()"
    );
  });

  it("finalizeERC20Withdrawal() :: unauthorized messenger", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token, l2Token },
      accounts: { deployer, recipient, stranger },
    } = ctx;

    await assert.revertsWith(
      l1TokenBridge
        .connect(stranger)
        .finalizeERC20Withdrawal(
          l1Token.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorUnauthorizedMessenger()"
    );
  });

  it("finalizeERC20Withdrawal() :: wrong cross domain sender", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token, l2Token, l1Messenger },
      accounts: { deployer, recipient, stranger, l1MessengerStubAsEOA },
    } = ctx;

    await l1Messenger.setXDomainMessageSender(stranger.address);

    await assert.revertsWith(
      l1TokenBridge
        .connect(l1MessengerStubAsEOA)
        .finalizeERC20Withdrawal(
          l1Token.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorWrongCrossDomainSender()"
    );
  });

  it("finalizeERC20Withdrawal()", async () => {
    const {
      l1TokenBridge,
      stubs: { l1Token, l2Token, l1Messenger },
      accounts: { deployer, recipient, l1MessengerStubAsEOA, l2TokenBridgeEOA },
    } = ctx;

    await l1Messenger.setXDomainMessageSender(l2TokenBridgeEOA.address);

    const bridgeBalanceBefore = await l1Token.balanceOf(l1TokenBridge.address);

    const amount = wei`1 ether`;
    const data = "0xdeadbeaf";

    const tx = await l1TokenBridge
      .connect(l1MessengerStubAsEOA)
      .finalizeERC20Withdrawal(
        l1Token.address,
        l2Token.address,
        deployer.address,
        recipient.address,
        amount,
        data
      );

    await assert.emits(l1TokenBridge, tx, "ERC20WithdrawalFinalized", [
      l1Token.address,
      l2Token.address,
      deployer.address,
      recipient.address,
      amount,
      data,
    ]);

    assert.equalBN(await l1Token.balanceOf(recipient.address), amount);
    assert.equalBN(
      await l1Token.balanceOf(l1TokenBridge.address),
      bridgeBalanceBefore.sub(amount)
    );
  });
});

async function ctxProvider() {
  const [deployer, l2TokenBridgeEOA, stranger, recipient] =
    await hre.ethers.getSigners();

  const l1MessengerStub = await new CrossDomainMessengerStub__factory(
    deployer
  ).deploy({ value: wei.toBigNumber(wei`1 ether`) });

  const l1TokenStub = await new ERC20Stub__factory(deployer).deploy(
    "L1 Token",
    "L1"
  );

  const l2TokenStub = await new ERC20Stub__factory(deployer).deploy(
    "L2 Token",
    "L2"
  );

  const emptyContract = await new EmptyContractStub__factory(deployer).deploy({
    value: wei.toBigNumber(wei`1 ether`),
  });
  const emptyContractAsEOA = await account.impersonate(emptyContract.address);

  const l1MessengerStubAsEOA = await account.impersonate(
    l1MessengerStub.address
  );

  const l1TokenBridgeImpl = await new L1TokenBridge__factory(deployer).deploy(
    l1MessengerStub.address,
    l2TokenBridgeEOA.address,
    l1TokenStub.address,
    l2TokenStub.address
  );

  const l1TokenBridgeProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(
    l1TokenBridgeImpl.address,
    deployer.address,
    l1TokenBridgeImpl.interface.encodeFunctionData("initialize", [
      deployer.address,
    ])
  );

  const l1TokenBridge = L1TokenBridge__factory.connect(
    l1TokenBridgeProxy.address,
    deployer
  );

  await l1TokenStub.transfer(l1TokenBridge.address, wei`100 ether`);

  const roles = await Promise.all([
    l1TokenBridge.DEPOSITS_ENABLER_ROLE(),
    l1TokenBridge.DEPOSITS_DISABLER_ROLE(),
    l1TokenBridge.WITHDRAWALS_ENABLER_ROLE(),
    l1TokenBridge.WITHDRAWALS_DISABLER_ROLE(),
  ]);

  for (const role of roles) {
    await l1TokenBridge.grantRole(role, deployer.address);
  }

  await l1TokenBridge.enableDeposits();
  await l1TokenBridge.enableWithdrawals();

  return {
    accounts: {
      deployer,
      stranger,
      l2TokenBridgeEOA,
      emptyContractAsEOA,
      recipient,
      l1MessengerStubAsEOA,
    },
    stubs: {
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l1Messenger: l1MessengerStub,
    },
    l1TokenBridge,
  };
}
