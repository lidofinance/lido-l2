import hre, { ethers } from "hardhat";
import { wei } from "../../utils/wei";
import {
  BridgeStub__factory,
  ERC20BridgedStub__factory,
  InboxStub__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  OssifiableProxy__factory,
  OutboxStub__factory,
  EmptyContractStub__factory,
} from "../../typechain";
import { assert } from "chai";
import { testsuite } from "../../utils/testing";

testsuite("Arbitrum :: L1ERC20TokenGateway unit tests", ctxProvider, (ctx) => {
  it("l1Token() returns correct value after deployment", async () => {
    assert.equal(
      await ctx.l1TokensGateway.l1Token(),
      ctx.stubs.l1Token.address
    );
  });

  it("l2Token() returns correct value after deployment", async () => {
    assert.equal(
      await ctx.l1TokensGateway.l2Token(),
      ctx.stubs.l2Token.address
    );
  });

  it("counterpartGateway() returns correct value after deployment", async () => {
    assert.equal(
      await ctx.l1TokensGateway.counterpartGateway(),
      ctx.stubs.l2TokensGateway.address
    );
  });

  it("router() returns correct value after deployment", async () => {
    assert.equal(
      await ctx.l1TokensGateway.router(),
      ctx.stubs.l1Router.address
    );
  });

  it("calculateL2TokenAddress() returns l2Token when called with l1Token", async () => {
    const actualL2TokenAddress =
      await ctx.l1TokensGateway.calculateL2TokenAddress(
        ctx.stubs.l1Token.address
      );
    assert.equal(actualL2TokenAddress, ctx.stubs.l2Token.address);
  });

  it("calculateL2TokenAddress() returns zero address when called with not l1Token", async () => {
    const wrongAddress = ctx.accounts.stranger.address;
    const actualL2TokenAddress =
      await ctx.l1TokensGateway.calculateL2TokenAddress(wrongAddress);
    assert.equal(actualL2TokenAddress, hre.ethers.constants.AddressZero);
  });

  it("getOutboundCalldata() returns encoded call or l2TokensGateway.finalizeInboundTransfer()", async () => {
    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.5 ether`;
    const actualCalldata = await ctx.l1TokensGateway.getOutboundCalldata(
      ctx.stubs.l1Token.address,
      sender.address,
      recipient.address,
      amount,
      "0x"
    );

    const expectedCalldata =
      ctx.stubs.l2TokensGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [
          ctx.stubs.l1Token.address,
          sender.address,
          recipient.address,
          amount,
          "0x",
        ]
      );

    assert.equal(actualCalldata, expectedCalldata);
  });

  it("outboundTransfer() :: deposits are disabled", async () => {
    // validate deposits are disabled
    assert.isFalse(await ctx.l1TokensGateway.isDepositsEnabled());

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const data = encodeSenderOutboundTransferData(maxSubmissionCost);

    // validate deposit reverts with error ErrorDepositsDisabled()
    assert.revertsWith(
      ctx.l1TokensGateway
        .connect(sender)
        .outboundTransfer(
          ctx.stubs.l1Token.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data
        ),
      "ErrorDepositsDisabled()"
    );
  });

  it("outboundTransfer() :: wrong l1Token address", async () => {
    const [sender, recipient, wrongAddress] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const data = encodeSenderOutboundTransferData(maxSubmissionCost);

    const {
      l1TokensGateway,
      accounts: { deployer },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l1TokensGateway.grantRole(
      await l1TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l1TokensGateway.enableDeposits();

    // validate deposits was enabled
    assert.isTrue(await l1TokensGateway.isDepositsEnabled());

    await assert.revertsWith(
      l1TokensGateway
        .connect(sender)
        .outboundTransfer(
          wrongAddress.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data
        ),
      "ErrorUnsupportedL1Token()"
    );
  });

  it("outboundTransfer() :: extra data not empty", async () => {
    const {
      l1TokensGateway,
      stubs: { l1Token },
      accounts: { deployer, l1RouterAsEOA },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l1TokensGateway.grantRole(
      await l1TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l1TokensGateway.enableDeposits();

    // validate deposits was enabled
    assert.isTrue(await l1TokensGateway.isDepositsEnabled());

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const value = wei`3000 gwei`;
    const data = encodeRouterOutboundTransferData(
      sender.address,
      maxSubmissionCost,
      "0xdeadbeef"
    );

    // initiate outbound transfer
    await assert.revertsWith(
      l1TokensGateway
        .connect(l1RouterAsEOA)
        .outboundTransfer(
          l1Token.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data,
          { value }
        ),
      "ExtraDataNotEmpty()"
    );
  });

  it("outboundTransfer() :: called by router", async () => {
    const {
      l1TokensGateway,
      stubs: { l1Token, inbox, l2TokensGateway },
      accounts: { deployer, sender, recipient, l1RouterAsEOA },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l1TokensGateway.grantRole(
      await l1TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l1TokensGateway.enableDeposits();

    // validate deposits was enabled
    assert.isTrue(await l1TokensGateway.isDepositsEnabled());

    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const value = wei`3000 gwei`;
    const data = encodeRouterOutboundTransferData(
      sender.address,
      maxSubmissionCost
    );

    const retryableTicketId = 7;
    await inbox.setRetryableTicketId(retryableTicketId);

    assert.equalBN(await inbox.retryableTicketId(), retryableTicketId);

    const senderBalanceBefore = await l1Token.balanceOf(sender.address);

    // set allowance for l1TokensGateway before transfer
    await l1Token.connect(sender).approve(l1TokensGateway.address, amount);

    // call tx locally to check return value
    assert.equal(
      await l1TokensGateway
        .connect(l1RouterAsEOA)
        .callStatic.outboundTransfer(
          l1Token.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data,
          { value }
        ),
      hre.ethers.utils.defaultAbiCoder.encode(["uint256"], [retryableTicketId])
    );

    // initiate outbound transfer
    const tx = await l1TokensGateway
      .connect(l1RouterAsEOA)
      .outboundTransfer(
        l1Token.address,
        recipient.address,
        amount,
        maxGas,
        gasPriceBid,
        data,
        { value }
      );

    // validate DepositInitiated event was emitted
    await assert.emits(l1TokensGateway, tx, "DepositInitiated", [
      l1Token.address,
      sender.address,
      recipient.address,
      retryableTicketId,
      amount,
    ]);

    const expectedCalldata = l2TokensGateway.interface.encodeFunctionData(
      "finalizeInboundTransfer",
      [l1Token.address, sender.address, recipient.address, amount, "0x"]
    );

    // validate TxToL2 was emitted
    await assert.emits(l1TokensGateway, tx, "TxToL2", [
      sender.address,
      l2TokensGateway.address,
      retryableTicketId,
      expectedCalldata,
    ]);

    // validate CreateRetryableTicketCalled event was emitted
    await assert.emits(inbox, tx, "CreateRetryableTicketCalled", [
      value,
      l2TokensGateway.address,
      0,
      maxSubmissionCost,
      sender.address,
      sender.address,
      maxGas,
      gasPriceBid,
      expectedCalldata,
    ]);

    // validate balance of the sender decreased
    assert.equalBN(
      await l1Token.balanceOf(sender.address),
      senderBalanceBefore.sub(amount)
    );

    // validate balance of the gateway increased
    assert.equalBN(await l1Token.balanceOf(l1TokensGateway.address), amount);
  });

  it("outboundTransfer() :: called by sender", async () => {
    const {
      l1TokensGateway,
      stubs: { l1Token, inbox, l2TokensGateway },
      accounts: { deployer },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l1TokensGateway.grantRole(
      await l1TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l1TokensGateway.enableDeposits();

    // validate deposits was enabled
    assert.isTrue(await l1TokensGateway.isDepositsEnabled());

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const value = wei`3000 gwei`;
    const data = encodeSenderOutboundTransferData(maxSubmissionCost);

    const senderBalanceBefore = await l1Token.balanceOf(sender.address);

    // set allowance for l1TokensGateway before transfer
    await l1Token.connect(sender).approve(l1TokensGateway.address, amount);

    const retryableTicketId = 13;
    await inbox.setRetryableTicketId(retryableTicketId);

    assert.equalBN(await inbox.retryableTicketId(), retryableTicketId);

    // initiate outbound transfer
    const tx = await l1TokensGateway
      .connect(sender)
      .outboundTransfer(
        l1Token.address,
        recipient.address,
        amount,
        maxGas,
        gasPriceBid,
        data,
        { value }
      );

    // validate DepositInitiated event was emitted
    await assert.emits(l1TokensGateway, tx, "DepositInitiated", [
      l1Token.address,
      sender.address,
      recipient.address,
      retryableTicketId,
      amount,
    ]);

    const expectedCalldata = l2TokensGateway.interface.encodeFunctionData(
      "finalizeInboundTransfer",
      [l1Token.address, sender.address, recipient.address, amount, "0x"]
    );

    // validate TxToL2 was emitted
    await assert.emits(l1TokensGateway, tx, "TxToL2", [
      sender.address,
      l2TokensGateway.address,
      retryableTicketId,
      expectedCalldata,
    ]);

    // validate CreateRetryableTicketCalled event was emitted
    await assert.emits(inbox, tx, "CreateRetryableTicketCalled", [
      value,
      l2TokensGateway.address,
      0,
      maxSubmissionCost,
      sender.address,
      sender.address,
      maxGas,
      gasPriceBid,
      expectedCalldata,
    ]);

    // validate balance of the sender decreased
    assert.equalBN(
      await l1Token.balanceOf(sender.address),
      senderBalanceBefore.sub(amount)
    );

    // validate balance of the gateway increased
    assert.equalBN(await l1Token.balanceOf(l1TokensGateway.address), amount);
  });

  it("finalizeInboundTransfer() :: withdrawals disabled", async () => {
    const {
      l1TokensGateway,
      accounts: { deployer, bridgeAsEOA, sender, recipient },
      stubs: { l1Token },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // validate withdrawals disabled
    assert.isFalse(await l1TokensGateway.isWithdrawalsEnabled());

    await assert.revertsWith(
      l1TokensGateway
        .connect(bridgeAsEOA)
        .finalizeInboundTransfer(
          l1Token.address,
          sender.address,
          recipient.address,
          wei`10 ether`,
          "0x"
        ),
      "ErrorWithdrawalsDisabled()"
    );
  });

  it("finalizeInboundTransfer() :: unauthorized bridge", async () => {
    const {
      l1TokensGateway,
      accounts: { deployer, stranger, sender, recipient },
      stubs: { l1Token },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l1TokensGateway.grantRole(
      await l1TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l1TokensGateway.enableWithdrawals();

    // validate withdrawals were enabled
    assert.isTrue(await l1TokensGateway.isWithdrawalsEnabled());

    // validate that stranger address is not counterpartGateway
    assert.notEqual(
      await l1TokensGateway.counterpartGateway(),
      stranger.address
    );

    // validate gateway reverts with ErrorUnauthorizedBridge()
    await assert.revertsWith(
      l1TokensGateway
        .connect(stranger)
        .finalizeInboundTransfer(
          l1Token.address,
          sender.address,
          recipient.address,
          wei`10 ether`,
          "0x"
        ),
      "ErrorUnauthorizedBridge()"
    );
  });

  it("finalizeInboundTransfer() :: wrong cross domain sender", async () => {
    const {
      l1TokensGateway,
      accounts: { deployer, stranger, sender, recipient, bridgeAsEOA },
      stubs: { l1Token, outbox },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l1TokensGateway.grantRole(
      await l1TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l1TokensGateway.enableWithdrawals();

    // validate withdrawals were enabled
    assert.isTrue(await l1TokensGateway.isWithdrawalsEnabled());

    // validate that stranger address is not counterpartGateway
    assert.notEqual(
      await l1TokensGateway.counterpartGateway(),
      stranger.address
    );

    // prepare OutboxStub to return wrong gateway address
    await outbox.setL2ToL1Sender(stranger.address);

    // validate gateway reverts with ErrorWrongCrossDomainSender()
    await assert.revertsWith(
      l1TokensGateway
        .connect(bridgeAsEOA)
        .finalizeInboundTransfer(
          l1Token.address,
          sender.address,
          recipient.address,
          wei`10 ether`,
          "0x"
        ),
      "ErrorWrongCrossDomainSender()"
    );
  });

  it("finalizeInboundTransfer() :: wrong token", async () => {
    const {
      l1TokensGateway,
      accounts: { stranger, sender, recipient, deployer, bridgeAsEOA },
    } = ctx;
    const wrongTokenAddress = stranger.address;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l1TokensGateway.grantRole(
      await l1TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l1TokensGateway.enableWithdrawals();

    // validate withdrawals were enabled
    assert.isTrue(await l1TokensGateway.isWithdrawalsEnabled());

    // validate gateway reverts with ErrorUnsupportedL1Token()
    await assert.revertsWith(
      l1TokensGateway
        .connect(bridgeAsEOA)
        .finalizeInboundTransfer(
          wrongTokenAddress,
          sender.address,
          recipient.address,
          wei`10 ether`,
          "0x"
        ),
      "ErrorUnsupportedL1Token()"
    );
  });

  it("finalizeInboundTransfer() :: works as expected", async () => {
    const {
      l1TokensGateway,
      accounts: { sender, recipient, deployer, bridgeAsEOA },
      stubs: { l1Token },
    } = ctx;

    // initialize gateway
    await l1TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l1TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l1TokensGateway.grantRole(
      await l1TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l1TokensGateway.enableWithdrawals();

    // validate withdrawals were enabled
    assert.isTrue(await l1TokensGateway.isWithdrawalsEnabled());

    // transfer l1Tokens to l1TokensGateway
    const initialL1GatewayBalance = wei`10_000 ether`;
    await l1Token.transfer(l1TokensGateway.address, initialL1GatewayBalance);

    // validate l1TokensGateway has enough amount of tokens
    assert.equal(
      await l1Token.balanceOf(l1TokensGateway.address).then(wei.fromBigNumber),
      initialL1GatewayBalance
    );

    const amount = wei`10 ether`;

    const tx = await l1TokensGateway
      .connect(bridgeAsEOA)
      .finalizeInboundTransfer(
        l1Token.address,
        sender.address,
        recipient.address,
        amount,
        "0x"
      );

    // validate WithdrawalFinalized was emitted
    assert.emits(l1TokensGateway, tx, "WithdrawalFinalized", [
      l1Token.address,
      sender.address,
      recipient.address,
      0,
      amount,
    ]);

    // validate tokens were transferred to recipient
    assert.equalBN(await l1Token.balanceOf(recipient.address), amount);

    // validate balance of the l1TokensGateway was decreased
    assert.equalBN(
      await l1Token.balanceOf(l1TokensGateway.address),
      wei.toBigNumber(initialL1GatewayBalance).sub(amount)
    );
  });
});

async function ctxProvider() {
  const [deployer, stranger, sender, recipient] = await hre.ethers.getSigners();
  const outboxStub = await new OutboxStub__factory(deployer).deploy();
  const bridgeStub = await new BridgeStub__factory(deployer).deploy(
    outboxStub.address,
    { value: wei.toBigNumber(wei`1 ether`) }
  );
  const inboxStub = await new InboxStub__factory(deployer).deploy(
    bridgeStub.address
  );
  const l1RouterStub = await new EmptyContractStub__factory(deployer).deploy({
    value: wei.toBigNumber(wei`1 ether`),
  });
  const l2TokensGatewayStub = await new EmptyContractStub__factory(
    deployer
  ).deploy();

  await outboxStub.setL2ToL1Sender(l2TokensGatewayStub.address);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [bridgeStub.address],
  });
  const l2TokenStub = await new EmptyContractStub__factory(deployer).deploy();
  const l1TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
    "ERC20 Mock",
    "ERC20"
  );
  await l1TokenStub.transfer(sender.address, wei`100 ether`);

  const l1TokensGatewayImpl = await new L1ERC20TokenGateway__factory(
    deployer
  ).deploy(
    inboxStub.address,
    l1RouterStub.address,
    l2TokensGatewayStub.address,
    l1TokenStub.address,
    l2TokenStub.address
  );
  const l1TokensGatewayProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(l1TokensGatewayImpl.address, deployer.address, "0x");

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [l1RouterStub.address],
  });
  const l1RouterAsEOA = await hre.ethers.getSigner(l1RouterStub.address);

  return {
    accounts: {
      deployer,
      stranger,
      sender,
      recipient,
      bridgeAsEOA: await ethers.getSigner(bridgeStub.address),
      l1RouterAsEOA,
    },
    stubs: {
      inbox: inboxStub,
      outbox: outboxStub,
      bridge: bridgeStub,
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l1Router: l1RouterStub,
      l2TokensGateway: L2ERC20TokenGateway__factory.connect(
        l2TokensGatewayStub.address,
        deployer
      ),
    },
    l1TokensGateway: L1ERC20TokenGateway__factory.connect(
      l1TokensGatewayProxy.address,
      deployer
    ),
  };
}

function encodeSenderOutboundTransferData(maxSubmissionCost: string) {
  return hre.ethers.utils.defaultAbiCoder.encode(
    ["uint256", "bytes"],
    [maxSubmissionCost, "0x"]
  );
}

function encodeRouterOutboundTransferData(
  sender: string,
  maxSubmissionCost: string,
  extraData = "0x"
) {
  return hre.ethers.utils.defaultAbiCoder.encode(
    ["address", "bytes"],
    [
      sender,
      hre.ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [maxSubmissionCost, extraData]
      ),
    ]
  );
}
