import { assert } from "chai";
import hre, { ethers } from "hardhat";
import {
  ERC20BridgedStub__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
  EmptyContractStub__factory,
} from "../../typechain";
import { CrossDomainMessengerStub__factory } from "../../typechain/factories/CrossDomainMessengerStub__factory";
import testing, { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";

unit("Optimism :: L1ERC20TokenBridge", ctxFactory)
  .test("l2TokenBridge()", async (ctx) => {
    assert.equal(
      await ctx.l1TokenBridge.l2TokenBridge(),
      ctx.accounts.l2TokenBridgeEOA.address
    );
  })

  .test("depositERC20() :: deposits disabled", async (ctx) => {
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
  })

  .test("depositsERC20() :: wrong l1Token address", async (ctx) => {
    await assert.revertsWith(
      ctx.l1TokenBridge.depositERC20(
        ctx.accounts.stranger.address,
        ctx.stubs.l2Token.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorUnsupportedL1Token()"
    );
  })

  .test("depositsERC20() :: wrong l2Token address", async (ctx) => {
    await assert.revertsWith(
      ctx.l1TokenBridge.depositERC20(
        ctx.stubs.l1Token.address,
        ctx.accounts.stranger.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorUnsupportedL2Token()"
    );
  })

  .test("depositERC20() :: not from EOA", async (ctx) => {
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
  })

  .test("depositERC20()", async (ctx) => {
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
      L2ERC20TokenBridge__factory.createInterface().encodeFunctionData(
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
  })

  .test("depositERC20To() :: deposits disabled", async (ctx) => {
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
  })

  .test("depositsERC20To() :: wrong l1Token address", async (ctx) => {
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
  })

  .test("depositsERC20To() :: wrong l2Token address", async (ctx) => {
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
  })

  .test("depositsERC20To() :: recipient is zero address", async (ctx) => {
    const {
      l1TokenBridge,
      stubs: { l1Token },
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      l1TokenBridge.depositERC20To(
        l1Token.address,
        stranger.address,
        ethers.constants.AddressZero,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("depositERC20To()", async (ctx) => {
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
      L2ERC20TokenBridge__factory.createInterface().encodeFunctionData(
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
  })

  .test(
    "finalizeERC20Withdrawal() :: withdrawals are disabled",
    async (ctx) => {
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
    }
  )

  .test("finalizeERC20Withdrawal() :: wrong l1Token", async (ctx) => {
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
      "ErrorUnsupportedL1Token()"
    );
  })

  .test("finalizeERC20Withdrawal() :: wrong l2Token", async (ctx) => {
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
      "ErrorUnsupportedL2Token()"
    );
  })

  .test("finalizeERC20Withdrawal() :: unauthorized messenger", async (ctx) => {
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
  })

  .test(
    "finalizeERC20Withdrawal() :: wrong cross domain sender",
    async (ctx) => {
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
    }
  )

  .test("finalizeERC20Withdrawal()", async (ctx) => {
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
  })

  .run();

async function ctxFactory() {
  const [deployer, l2TokenBridgeEOA, stranger, recipient, rebasableToken] =
    await hre.ethers.getSigners();

  const l1MessengerStub = await new CrossDomainMessengerStub__factory(
    deployer
  ).deploy({ value: wei.toBigNumber(wei`1 ether`) });

  const l1TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
    "L1 Token",
    "L1"
  );

  const l2TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
    "L2 Token",
    "L2"
  );

  const emptyContract = await new EmptyContractStub__factory(deployer).deploy({
    value: wei.toBigNumber(wei`1 ether`),
  });
  const emptyContractAsEOA = await testing.impersonate(emptyContract.address);

  const l1MessengerStubAsEOA = await testing.impersonate(
    l1MessengerStub.address
  );

  const l1TokenBridgeImpl = await new L1ERC20TokenBridge__factory(
    deployer
  ).deploy(
    l1MessengerStub.address,
    l2TokenBridgeEOA.address,
    l1TokenStub.address,
    rebasableToken.address,
    l2TokenStub.address,
    rebasableToken.address
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

  const l1TokenBridge = L1ERC20TokenBridge__factory.connect(
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
      l1TokenRebasable: l1TokenStub,
      l2TokenRebasable: l2TokenStub,
      l1Messenger: l1MessengerStub,
    },
    l1TokenBridge,
  };
}
