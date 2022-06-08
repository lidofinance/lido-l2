import hre, { ethers } from "hardhat";
import { wei } from "../../utils/wei";
import {
  ERC20Stub__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  OssifiableProxy__factory,
  EmptyContractStub__factory,
} from "../../typechain";
import { assert } from "chai";
import { testsuite } from "../../utils/testing";
import { ArbSysStub__factory } from "../../typechain/factories/ArbSysStub__factory";

testsuite("L1TokensGateway unit tests", ctxProvider, (ctx) => {
  it("l1Token()", async () => {
    assert.equal(
      await ctx.l2TokensGateway.l1Token(),
      ctx.stubs.l1Token.address
    );
  });

  it("l2Token()", async () => {
    assert.equal(
      await ctx.l2TokensGateway.l2Token(),
      ctx.stubs.l2Token.address
    );
  });

  it("counterpartGateway()", async () => {
    assert.equal(
      await ctx.l2TokensGateway.counterpartGateway(),
      ctx.stubs.l1TokensGateway.address
    );
  });

  it("router() ", async () => {
    assert.equal(
      await ctx.l2TokensGateway.router(),
      ctx.stubs.l2Router.address
    );
  });

  it("calculateL2TokenAddress() :: correct l1Token address", async () => {
    const actualL2TokenAddress =
      await ctx.l2TokensGateway.calculateL2TokenAddress(
        ctx.stubs.l1Token.address
      );
    assert.equal(actualL2TokenAddress, ctx.stubs.l2Token.address);
  });

  it("calculateL2TokenAddress() :: incorrect l1Token address", async () => {
    const wrongAddress = ctx.accounts.stranger.address;
    const actualL2TokenAddress =
      await ctx.l2TokensGateway.calculateL2TokenAddress(wrongAddress);
    assert.equal(actualL2TokenAddress, hre.ethers.constants.AddressZero);
  });

  it("getOutboundCalldata()", async () => {
    const {
      l2TokensGateway,
      stubs: { l1Token, l1TokensGateway },
      accounts: { sender, recipient },
    } = ctx;
    const amount = wei`1.5 ether`;
    const actualCalldata = await l2TokensGateway.getOutboundCalldata(
      l1Token.address,
      sender.address,
      recipient.address,
      amount
    );

    const expectedCalldata = l1TokensGateway.interface.encodeFunctionData(
      "finalizeInboundTransfer",
      [l1Token.address, sender.address, recipient.address, amount, "0x"]
    );

    assert.equal(actualCalldata, expectedCalldata);
  });

  it("outboundTransfer() :: withdrawals are disabled", async () => {
    const {
      l2TokensGateway,
      accounts: { sender, recipient },
    } = ctx;
    // validate deposits are disabled
    assert.isFalse(await l2TokensGateway.isDepositsEnabled());

    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const data = encodeOutboundTransferData(maxSubmissionCost);

    // validate deposit reverts with error ErrorDepositsDisabled()
    assert.revertsWith(
      l2TokensGateway
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
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const maxSubmissionCost = wei`11_000 gwei`;
    const data = encodeOutboundTransferData(maxSubmissionCost);

    const {
      l2TokensGateway,
      accounts: { deployer, sender, recipient },
      stubs: { l2Token: wrongAddress },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l2TokensGateway.grantRole(
      await l2TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l2TokensGateway.enableWithdrawals();

    // validate deposits was enabled
    assert.isTrue(await l2TokensGateway.isWithdrawalsEnabled());

    await assert.revertsWith(
      l2TokensGateway
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
      l2TokensGateway,
      stubs: { l1Token },
      accounts: { deployer },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l2TokensGateway.grantRole(
      await l2TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l2TokensGateway.enableWithdrawals();

    // validate deposits was enabled
    assert.isTrue(await l2TokensGateway.isWithdrawalsEnabled());

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const data = "0xdeadbeaf";

    // initiate outbound transfer
    await assert.revertsWith(
      l2TokensGateway
        .connect(sender)
        .outboundTransfer(
          l1Token.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data
        ),
      "ExtraDataNotEmpty()"
    );
  });

  it("outboundTransfer() :: called by router", async () => {
    const {
      l2TokensGateway,
      stubs: { l1Token, arbSys, l1TokensGateway },
      accounts: { deployer, l2RouterAsEOA },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l2TokensGateway.grantRole(
      await l2TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l2TokensGateway.enableWithdrawals();

    // validate deposits was enabled
    assert.isTrue(await l2TokensGateway.isWithdrawalsEnabled());

    const l2ToL1Id = 10;

    // set l2ToL1Id value in ArbSysStub
    await arbSys.setl2ToL1TxId(l2ToL1Id);

    // validate value was set
    assert.equalBN(await arbSys.l2ToL1TxId(), l2ToL1Id);

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const data = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes"],
      [sender.address, "0x"]
    );

    // initiate outbound transfer
    const tx = await l2TokensGateway
      .connect(l2RouterAsEOA)
      .outboundTransfer(
        l1Token.address,
        recipient.address,
        amount,
        maxGas,
        gasPriceBid,
        data
      );

    // validate DepositInitiated event was emitted
    await assert.emits(l2TokensGateway, tx, "WithdrawalInitiated", [
      l1Token.address,
      sender.address,
      recipient.address,
      l2ToL1Id,
      0,
      amount,
    ]);

    // validate CreateL2ToL1Tx event was emitted
    const expectedCalldata =
      ctx.stubs.l1TokensGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [l1Token.address, sender.address, recipient.address, amount, "0x"]
      );
    await assert.emits(arbSys, tx, "CreateL2ToL1Tx", [
      l1TokensGateway.address,
      expectedCalldata,
    ]);
  });

  it("outboundTransfer() :: called by sender", async () => {
    const {
      l2TokensGateway,
      stubs: { l1Token, arbSys, l1TokensGateway },
      accounts: { deployer },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable deposits
    await l2TokensGateway.grantRole(
      await l2TokensGateway.WITHDRAWALS_ENABLER_ROLE(),
      deployer.address
    );

    // enable deposits
    await l2TokensGateway.enableWithdrawals();

    // validate deposits was enabled
    assert.isTrue(await l2TokensGateway.isWithdrawalsEnabled());

    const l2ToL1Id = 10;

    // set l2ToL1Id value in ArbSysStub
    await arbSys.setl2ToL1TxId(l2ToL1Id);

    // validate value was set
    assert.equalBN(await arbSys.l2ToL1TxId(), l2ToL1Id);

    const [sender, recipient] = await hre.ethers.getSigners();
    const amount = wei`1.2 ether`;
    const maxGas = wei`1000 gwei`;
    const gasPriceBid = wei`2000 gwei`;
    const data = "0x";

    // call tx locally to check return value
    assert.equal(
      await l2TokensGateway
        .connect(sender)
        .callStatic.outboundTransfer(
          l1Token.address,
          recipient.address,
          amount,
          maxGas,
          gasPriceBid,
          data
        ),
      hre.ethers.utils.defaultAbiCoder.encode(["uint256"], [l2ToL1Id])
    );

    // initiate outbound transfer
    const tx = await l2TokensGateway
      .connect(sender)
      .outboundTransfer(
        l1Token.address,
        recipient.address,
        amount,
        maxGas,
        gasPriceBid,
        data
      );

    // validate DepositInitiated event was emitted
    await assert.emits(l2TokensGateway, tx, "WithdrawalInitiated", [
      l1Token.address,
      sender.address,
      recipient.address,
      l2ToL1Id,
      0,
      amount,
    ]);

    // validate CreateL2ToL1Tx event was emitted
    const expectedCalldata =
      ctx.stubs.l1TokensGateway.interface.encodeFunctionData(
        "finalizeInboundTransfer",
        [l1Token.address, sender.address, recipient.address, amount, "0x"]
      );
    await assert.emits(arbSys, tx, "CreateL2ToL1Tx", [
      l1TokensGateway.address,
      expectedCalldata,
    ]);
  });

  it("finalizeInboundTransfer() :: wrong token", async () => {
    const {
      l2TokensGateway,
      accounts: {
        stranger,
        sender,
        recipient,
        deployer,
        l1TokensGatewayAliasedEOA,
      },
    } = ctx;
    const wrongTokenAddress = stranger.address;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l2TokensGateway.grantRole(
      await l2TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l2TokensGateway.enableDeposits();

    // validate withdrawals were enabled
    assert.isTrue(await l2TokensGateway.isDepositsEnabled());

    // validate gateway reverts with error ErrorUnsupportedL1Token()
    await assert.revertsWith(
      l2TokensGateway
        .connect(l1TokensGatewayAliasedEOA)
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

  it("finalizeInboundTransfer() :: not counterpart gateway", async () => {
    const {
      l2TokensGateway,
      accounts: { deployer, stranger, sender, recipient },
      stubs: { l1Token },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant DEPOSITS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l2TokensGateway.grantRole(
      await l2TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l2TokensGateway.enableDeposits();

    // validate withdrawals were enabled
    assert.isTrue(await l2TokensGateway.isDepositsEnabled());

    // validate that stranger address is not counterpartGateway
    assert.notEqual(
      await l2TokensGateway.counterpartGateway(),
      stranger.address
    );

    // validate gateway reverts with error ErrorWrongCrossDomainSender()
    await assert.revertsWith(
      l2TokensGateway
        .connect(stranger)
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

  it("finalizeInboundTransfer() :: works as expected", async () => {
    const {
      l2TokensGateway,
      accounts: { sender, recipient, deployer, l1TokensGatewayAliasedEOA },
      stubs: { l1Token, l2Token },
    } = ctx;

    // initialize gateway
    await l2TokensGateway.initialize(deployer.address);

    // validate gateway was initialized
    assert.isTrue(await l2TokensGateway.isInitialized());

    // grant WITHDRAWALS_ENABLER_ROLE to the l1Deployer to enable withdrawals
    await l2TokensGateway.grantRole(
      await l2TokensGateway.DEPOSITS_ENABLER_ROLE(),
      deployer.address
    );

    // enable withdrawals
    await l2TokensGateway.enableDeposits();

    // validate withdrawals were enabled
    assert.isTrue(await l2TokensGateway.isDepositsEnabled());

    // transfer l2Tokens to l2TokensGateway
    const initialL2GatewayBalance = wei`10_000 ether`;
    await l2Token.transfer(l2TokensGateway.address, initialL2GatewayBalance);

    // validate l1TokensGateway has enough amount of tokens
    assert.equal(
      await l2Token.balanceOf(l2TokensGateway.address).then(wei.fromBigNumber),
      initialL2GatewayBalance
    );

    const amount = wei`10 ether`;

    const tx = await l2TokensGateway
      .connect(l1TokensGatewayAliasedEOA)
      .finalizeInboundTransfer(
        l1Token.address,
        sender.address,
        recipient.address,
        wei`10 ether`,
        "0x"
      );

    // validate DepositFinalized was emitted
    await assert.emits(l2TokensGateway, tx, "DepositFinalized", [
      l1Token.address,
      sender.address,
      recipient.address,
      amount,
    ]);

    // validate tokens were minted to recipient
    assert.equalBN(await l2Token.balanceOf(recipient.address), amount);
  });
});

async function ctxProvider() {
  const [deployer, stranger, sender, recipient] = await hre.ethers.getSigners();
  const l2RouterStub = await new EmptyContractStub__factory(deployer).deploy({
    value: wei.toBigNumber(wei`1 ether`),
  });
  const l1TokensGatewayStub = await new EmptyContractStub__factory(
    deployer
  ).deploy({ value: wei.toBigNumber(wei`1 ether`) });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [l1TokensGatewayStub.address],
  });
  const l2TokenStub = await new ERC20Stub__factory(deployer).deploy(
    "L2Token stub",
    "L2ERC20"
  );
  const l1TokenStub = await new ERC20Stub__factory(deployer).deploy(
    "ERC20 Mock",
    "ERC20"
  );

  const arbSysStub = await new ArbSysStub__factory(deployer).deploy();
  const l2TokensGatewayImpl = await new L2ERC20TokenGateway__factory(
    deployer
  ).deploy(
    arbSysStub.address, // the default address of the
    l2RouterStub.address,
    l1TokensGatewayStub.address,
    l1TokenStub.address,
    l2TokenStub.address
  );
  const l2TokensGatewayProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(l2TokensGatewayImpl.address, deployer.address, "0x");

  const l1TokensGatewayAliasedEOAAddress = hre.ethers.BigNumber.from(
    l1TokensGatewayStub.address
  )
    .add("0x1111000000000000000000000000000000001111")
    .toHexString();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [l1TokensGatewayAliasedEOAAddress],
  });

  const l1TokensGatewayAliasedEOA = await hre.ethers.getSigner(
    l1TokensGatewayAliasedEOAAddress
  );

  await deployer.sendTransaction({
    to: l1TokensGatewayAliasedEOA.address,
    value: wei.toBigNumber(wei`1 ether`),
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [l2RouterStub.address],
  });
  const l2RouterAsEOA = await hre.ethers.getSigner(l2RouterStub.address);

  return {
    accounts: {
      deployer,
      stranger,
      sender,
      recipient,
      l2RouterAsEOA,
      l1TokensGatewayEOA: await ethers.getSigner(l1TokensGatewayStub.address),
      l1TokensGatewayAliasedEOA,
    },
    stubs: {
      arbSys: arbSysStub,
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l2Router: l2RouterStub,
      l1TokensGateway: L1ERC20TokenGateway__factory.connect(
        l1TokensGatewayStub.address,
        deployer
      ),
    },
    l2TokensGateway: L2ERC20TokenGateway__factory.connect(
      l2TokensGatewayProxy.address,
      deployer
    ),
  };
}

function encodeOutboundTransferData(maxSubmissionCost: string) {
  return hre.ethers.utils.defaultAbiCoder.encode(
    ["uint256", "bytes"],
    [maxSubmissionCost, "0x"]
  );
}
