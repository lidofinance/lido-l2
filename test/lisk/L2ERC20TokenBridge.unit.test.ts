import hre from "hardhat";
import {
  ERC20BridgedStub__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  OssifiableProxy__factory,
  EmptyContractStub__factory,
  CrossDomainMessengerStub__factory,
} from "../../typechain";
import testing, { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";
import { assert } from "chai";

unit("Lisk:: L2ERC20TokenBridge", ctxFactory)
  .test("l1TokenBridge()", async (ctx) => {
    assert.equal(
      await ctx.l2TokenBridge.l1TokenBridge(),
      ctx.accounts.l1TokenBridgeEOA.address
    );
  })

  .test("withdraw() :: withdrawals disabled", async (ctx) => {
    const {
      l2TokenBridge,
      stubs: { l2Token: l2TokenStub },
    } = ctx;

    await ctx.l2TokenBridge.disableWithdrawals();

    assert.isFalse(await ctx.l2TokenBridge.isWithdrawalsEnabled());

    await assert.revertsWith(
      l2TokenBridge.withdraw(
        l2TokenStub.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorWithdrawalsDisabled()"
    );
  })

  .test("withdraw() :: unsupported l2Token", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { stranger },
    } = ctx;
    await assert.revertsWith(
      l2TokenBridge.withdraw(stranger.address, wei`1 ether`, wei`1 gwei`, "0x"),
      "ErrorUnsupportedL2Token()"
    );
  })

  .test("withdraw()", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { deployer, l1TokenBridgeEOA },
      stubs: {
        l2Messenger: l2MessengerStub,
        l1Token: l1TokenStub,
        l2Token: l2TokenStub,
      },
    } = ctx;

    const deployerBalanceBefore = await l2TokenStub.balanceOf(deployer.address);
    const totalSupplyBefore = await l2TokenStub.totalSupply();

    const amount = wei`1 ether`;
    const l1Gas = wei`1 wei`;
    const data = "0xdeadbeaf";

    const tx = await l2TokenBridge.withdraw(
      l2TokenStub.address,
      amount,
      l1Gas,
      data
    );

    await assert.emits(l2TokenBridge, tx, "WithdrawalInitiated", [
      l1TokenStub.address,
      l2TokenStub.address,
      deployer.address,
      deployer.address,
      amount,
      data,
    ]);

    await assert.emits(l2MessengerStub, tx, "SentMessage", [
      l1TokenBridgeEOA.address,
      l2TokenBridge.address,
      L1ERC20TokenBridge__factory.createInterface().encodeFunctionData(
        "finalizeERC20Withdrawal",
        [
          l1TokenStub.address,
          l2TokenStub.address,
          deployer.address,
          deployer.address,
          amount,
          data,
        ]
      ),
      1, // message nonce
      l1Gas,
    ]);

    assert.equalBN(
      await l2TokenStub.balanceOf(deployer.address),
      deployerBalanceBefore.sub(amount)
    );

    assert.equalBN(
      await l2TokenStub.totalSupply(),
      totalSupplyBefore.sub(amount)
    );
  })

  .test("withdrawTo() :: withdrawals disabled", async (ctx) => {
    const {
      l2TokenBridge,
      stubs: { l2Token: l2TokenStub },
      accounts: { recipient },
    } = ctx;

    await ctx.l2TokenBridge.disableWithdrawals();

    assert.isFalse(await ctx.l2TokenBridge.isWithdrawalsEnabled());

    await assert.revertsWith(
      l2TokenBridge.withdrawTo(
        l2TokenStub.address,
        recipient.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorWithdrawalsDisabled()"
    );
  })

  .test("withdrawTo() :: unsupported l2Token", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { stranger, recipient },
    } = ctx;
    await assert.revertsWith(
      l2TokenBridge.withdrawTo(
        stranger.address,
        recipient.address,
        wei`1 ether`,
        wei`1 gwei`,
        "0x"
      ),
      "ErrorUnsupportedL2Token()"
    );
  })

  .test("withdrawTo()", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { deployer, recipient, l1TokenBridgeEOA },
      stubs: {
        l2Messenger: l2MessengerStub,
        l1Token: l1TokenStub,
        l2Token: l2TokenStub,
      },
    } = ctx;

    const deployerBalanceBefore = await l2TokenStub.balanceOf(deployer.address);
    const totalSupplyBefore = await l2TokenStub.totalSupply();

    const amount = wei`1 ether`;
    const l1Gas = wei`1 wei`;
    const data = "0xdeadbeaf";

    const tx = await l2TokenBridge.withdrawTo(
      l2TokenStub.address,
      recipient.address,
      amount,
      l1Gas,
      data
    );

    await assert.emits(l2TokenBridge, tx, "WithdrawalInitiated", [
      l1TokenStub.address,
      l2TokenStub.address,
      deployer.address,
      recipient.address,
      amount,
      data,
    ]);

    await assert.emits(l2MessengerStub, tx, "SentMessage", [
      l1TokenBridgeEOA.address,
      l2TokenBridge.address,
      L1ERC20TokenBridge__factory.createInterface().encodeFunctionData(
        "finalizeERC20Withdrawal",
        [
          l1TokenStub.address,
          l2TokenStub.address,
          deployer.address,
          recipient.address,
          amount,
          data,
        ]
      ),
      1, // message nonce
      l1Gas,
    ]);

    assert.equalBN(
      await l2TokenStub.balanceOf(deployer.address),
      deployerBalanceBefore.sub(amount)
    );

    assert.equalBN(
      await l2TokenStub.totalSupply(),
      totalSupplyBefore.sub(amount)
    );
  })

  .test("finalizeDeposit() :: deposits disabled", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { l2MessengerStubEOA, deployer, recipient },
      stubs: { l1Token: l1TokenStub, l2Token: l2TokenStub },
    } = ctx;

    await l2TokenBridge.disableDeposits();

    assert.isFalse(await l2TokenBridge.isDepositsEnabled());

    await assert.revertsWith(
      l2TokenBridge
        .connect(l2MessengerStubEOA)
        .finalizeDeposit(
          l1TokenStub.address,
          l2TokenStub.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorDepositsDisabled()"
    );
  })

  .test("finalizeDeposit() :: unsupported l1Token", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { l2MessengerStubEOA, deployer, recipient, stranger },
      stubs: { l2Token: l2TokenStub },
    } = ctx;

    await assert.revertsWith(
      l2TokenBridge
        .connect(l2MessengerStubEOA)
        .finalizeDeposit(
          stranger.address,
          l2TokenStub.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorUnsupportedL1Token()"
    );
  })

  .test("finalizeDeposit() :: unsupported l2Token", async (ctx) => {
    const {
      l2TokenBridge,
      accounts: { l2MessengerStubEOA, deployer, recipient, stranger },
      stubs: { l1Token: l1TokenStub },
    } = ctx;

    await assert.revertsWith(
      l2TokenBridge
        .connect(l2MessengerStubEOA)
        .finalizeDeposit(
          l1TokenStub.address,
          stranger.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorUnsupportedL2Token()"
    );
  })

  .test("finalizeDeposit() :: unauthorized messenger", async (ctx) => {
    const {
      l2TokenBridge,
      stubs: { l1Token, l2Token },
      accounts: { deployer, recipient, stranger },
    } = ctx;

    await assert.revertsWith(
      l2TokenBridge
        .connect(stranger)
        .finalizeDeposit(
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

  .test("finalizeDeposit() :: wrong cross domain sender", async (ctx) => {
    const {
      l2TokenBridge,
      stubs: { l1Token, l2Token, l2Messenger },
      accounts: { deployer, recipient, stranger, l2MessengerStubEOA },
    } = ctx;

    await l2Messenger.setXDomainMessageSender(stranger.address);

    await assert.revertsWith(
      l2TokenBridge
        .connect(l2MessengerStubEOA)
        .finalizeDeposit(
          l1Token.address,
          l2Token.address,
          deployer.address,
          recipient.address,
          wei`1 ether`,
          "0x"
        ),
      "ErrorWrongCrossDomainSender()"
    );
  })

  .test("finalizeDeposit()", async (ctx) => {
    const {
      l2TokenBridge,
      stubs: { l1Token, l2Token, l2Messenger },
      accounts: { deployer, recipient, l2MessengerStubEOA, l1TokenBridgeEOA },
    } = ctx;

    await l2Messenger.setXDomainMessageSender(l1TokenBridgeEOA.address);

    const totalSupplyBefore = await l2Token.totalSupply();

    const amount = wei`1 ether`;
    const data = "0xdeadbeaf";

    const tx = await l2TokenBridge
      .connect(l2MessengerStubEOA)
      .finalizeDeposit(
        l1Token.address,
        l2Token.address,
        deployer.address,
        recipient.address,
        amount,
        data
      );

    await assert.emits(l2TokenBridge, tx, "DepositFinalized", [
      l1Token.address,
      l2Token.address,
      deployer.address,
      recipient.address,
      amount,
      data,
    ]);

    assert.equalBN(await l2Token.balanceOf(recipient.address), amount);
    assert.equalBN(await l2Token.totalSupply(), totalSupplyBefore.add(amount));
  })

  .run();

async function ctxFactory() {
  const [deployer, stranger, recipient, l1TokenBridgeEOA] =
    await hre.ethers.getSigners();

  const l2Messenger = await new CrossDomainMessengerStub__factory(
    deployer
  ).deploy({ value: wei.toBigNumber(wei`1 ether`) });

  const l2MessengerStubEOA = await testing.impersonate(l2Messenger.address);

  const l1Token = await new ERC20BridgedStub__factory(deployer).deploy(
    "L1 Token",
    "L1"
  );

  const l2Token = await new ERC20BridgedStub__factory(deployer).deploy(
    "L2 Token",
    "L2"
  );

  const emptyContract = await new EmptyContractStub__factory(deployer).deploy({
    value: wei.toBigNumber(wei`1 ether`),
  });
  const emptyContractEOA = await testing.impersonate(emptyContract.address);

  const l2TokenBridgeImpl = await new L2ERC20TokenBridge__factory(
    deployer
  ).deploy(
    l2Messenger.address,
    l1TokenBridgeEOA.address,
    l1Token.address,
    l2Token.address
  );

  const l2TokenBridgeProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(
    l2TokenBridgeImpl.address,
    deployer.address,
    l2TokenBridgeImpl.interface.encodeFunctionData("initialize", [
      deployer.address,
    ])
  );

  const l2TokenBridge = L2ERC20TokenBridge__factory.connect(
    l2TokenBridgeProxy.address,
    deployer
  );

  await l2Token.transfer(l2TokenBridge.address, wei`100 ether`);

  const roles = await Promise.all([
    l2TokenBridge.DEPOSITS_ENABLER_ROLE(),
    l2TokenBridge.DEPOSITS_DISABLER_ROLE(),
    l2TokenBridge.WITHDRAWALS_ENABLER_ROLE(),
    l2TokenBridge.WITHDRAWALS_DISABLER_ROLE(),
  ]);

  for (const role of roles) {
    await l2TokenBridge.grantRole(role, deployer.address);
  }

  await l2TokenBridge.enableDeposits();
  await l2TokenBridge.enableWithdrawals();

  return {
    stubs: { l1Token, l2Token, l2Messenger: l2Messenger },
    accounts: {
      deployer,
      stranger,
      recipient,
      l2MessengerStubEOA,
      emptyContractEOA,
      l1TokenBridgeEOA,
    },
    l2TokenBridge,
  };
}
