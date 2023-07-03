import hre from "hardhat";
import { wei } from "../../../utils/wei";
import { assert, expect } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "ethers";
import { describe } from "mocha";
import { richWallet } from "../../l1/scripts/rich_wallet";

const TESTNET_PROVIDER_URL = "http://localhost:3050";

describe("ZkSync :: L2ERC20Bridge", async () => {
  async function setup() {
    const provider = new Provider(TESTNET_PROVIDER_URL);

    const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
    const governor = new Wallet(richWallet[1].privateKey, provider);
    const sender = new Wallet(richWallet[2].privateKey, provider);
    const recipient = new Wallet(richWallet[3].privateKey, provider);
    const stranger = new Wallet(richWallet[4].privateKey, provider);

    const deployer = new Deployer(hre, deployerWallet);

    // L2 Token
    const L2TokenArtifact = await deployer.loadArtifact("ERC20BridgedStub");
    const L2TokenContract = await deployer.deploy(L2TokenArtifact, [
      "wstEth",
      "wstEth",
    ]);

    const l2Token = await L2TokenContract.deployed();

    // L1 Token
    const emptyContractStubArtifact = await deployer.loadArtifact(
      "EmptyContractStub"
    );
    const l1TokenImplContract = await deployer.deploy(
      emptyContractStubArtifact
    );
    const l1Token = await l1TokenImplContract.deployed();

    const ossifiableProxyArtifact = await deployer.loadArtifact(
      "OssifiableProxy"
    );

    // L1 Bridge
    const L1ERC20BridgeStubArtifact = await deployer.loadArtifact(
      "L1ERC20BridgeStub"
    );
    const l1BridgeContract = await deployer.deploy(L1ERC20BridgeStubArtifact);
    const l1Bridge = await l1BridgeContract.deployed();
    const l1BridgeContractWrong = await deployer.deploy(
      L1ERC20BridgeStubArtifact
    );
    const l1BridgeWrong = await l1BridgeContractWrong.deployed();

    const L1BridgeAddress = utils.undoL1ToL2Alias(l1Bridge.address);

    // L2 Bridge
    const l2ERC20BridgeArtifact = await deployer.loadArtifact("L2ERC20Bridge");
    const l2Erc20BridgeImplContract = await deployer.deploy(
      l2ERC20BridgeArtifact,
      []
    );
    const l2Erc20BridgeImpl = await l2Erc20BridgeImplContract.deployed();

    // proxy
    const l2Erc20BridgeProxyContract = await deployer.deploy(
      ossifiableProxyArtifact,
      [l2Erc20BridgeImpl.address, governor.address, "0x"]
    );
    const l2Erc20BridgeProxy = await l2Erc20BridgeProxyContract.deployed();

    const l2Erc20Bridge = new Contract(
      l2Erc20BridgeProxy.address,
      l2ERC20BridgeArtifact.abi,
      deployer.zkWallet
    );

    const initTx = await l2Erc20Bridge["initialize(address,address,address)"](
      ethers.utils.getAddress(L1BridgeAddress),
      l1Token.address,
      l2Token.address
    );

    await initTx.wait();

    await (await l2Token.setBridge(l2Erc20Bridge.address)).wait();

    return {
      accounts: {
        deployerWallet,
        governor,
        recipient,
        sender,
        stranger,
      },
      stubs: {
        l1Bridge: ethers.utils.getAddress(L1BridgeAddress),
        l1Token: l1Token,
        l2Token: l2Token,
      },
      l2Erc20Bridge,
      l1Erc20Bridge: l1Bridge,
      l1Erc20BridgeWrong: l1BridgeWrong,
    };
  }

  let context: any;
  before("Setting up the context", async () => {
    context = await setup();
  });

  it("l1Bridge()", async () => {
    const { l2Erc20Bridge, stubs } = context;
    assert.equal(await l2Erc20Bridge.l1Bridge(), stubs.l1Bridge);
  });
  it("l1Token()", async () => {
    const { l2Erc20Bridge, stubs } = context;
    assert.equal(await l2Erc20Bridge.l1Token(), stubs.l1Token.address);
  });
  it("l2Token()", async () => {
    const { l2Erc20Bridge, stubs } = context;
    assert.equal(await l2Erc20Bridge.l2Token(), stubs.l2Token.address);
  });
  it("l1TokenAddress() :: correct L1 token", async () => {
    const { l2Erc20Bridge, stubs } = context;
    const fetchedL1TokenAddress = await l2Erc20Bridge.l1TokenAddress(
      stubs.l2Token.address
    );
    assert.equal(fetchedL1TokenAddress, stubs.l1Token.address);
  });
  it("l1TokenAddress() :: incorrect L1 Token", async () => {
    const { l2Erc20Bridge, stubs } = context;
    const fetchedL1TokenAddress = await l2Erc20Bridge.l1TokenAddress(
      stubs.l2Token.address
    );
    assert.equal(fetchedL1TokenAddress, stubs.l1Token.address);
  });
  it("l2TokenAddress() :: correct L2 Token", async () => {
    const { l2Erc20Bridge, stubs } = context;

    const fetchedL2TokenAddress = await l2Erc20Bridge.l2TokenAddress(
      stubs.l1Token.address
    );
    assert.equal(fetchedL2TokenAddress, stubs.l2Token.address);
  });
  it("l2TokenAddress() :: incorrect L2 Token", async () => {
    const { l2Erc20Bridge, accounts } = context;

    const fetchedL2TokenAddress = await l2Erc20Bridge.l2TokenAddress(
      accounts.stranger.address
    );
    assert.equal(fetchedL2TokenAddress, ethers.constants.AddressZero);
  });
  it("deposit() :: deposits are disabled", async () => {
    const { l2Erc20Bridge, accounts, stubs, l1Erc20Bridge } = context;
    const { deployerWallet, sender, recipient } = accounts;

    assert.isFalse(await l2Erc20Bridge.isDepositsEnabled());

    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    expect(
      await l1Erc20Bridge.deposit(
        recipient.address,
        stubs.l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        l2Erc20Bridge.address,
        "0x",
        { gasLimit: 10_000_000 }
      )
    ).to.be.revertedWith("ErrorDepositsDisabled");

    await enableDepositsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
  });
  it("deposit() :: wrong l1Token address", async () => {
    const { l2Erc20Bridge, accounts, l1Erc20Bridge } = context;
    const { deployerWallet, sender, recipient } = accounts;

    await enableDepositsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    const wrongL1TokenAddress = accounts.stranger.address;

    expect(
      await l1Erc20Bridge.deposit(
        recipient.address,
        wrongL1TokenAddress,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        l2Erc20Bridge.address,
        "0x",
        { gasLimit: 10_000_000 }
      )
    ).to.be.revertedWith("ErrorUnsupportedL1Token");
  });
  it("deposit() :: wrong domain sender", async () => {
    const { l2Erc20Bridge, accounts, stubs, l1Erc20BridgeWrong } = context;
    const { deployerWallet, sender, recipient } = accounts;

    await enableDepositsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    expect(
      await l1Erc20BridgeWrong.deposit(
        recipient.address,
        stubs.l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        l2Erc20Bridge.address,
        "0x",
        { gasLimit: 10_000_000 }
      )
    ).to.be.revertedWith("ErrorWrongCrossDomainSender");
  });
  it("deposit() :: wrong (zero) value", async () => {
    const { l2Erc20Bridge, accounts, stubs, l1Erc20Bridge } = context;
    const { deployerWallet, sender, recipient } = accounts;

    await enableDepositsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
    const amount = wei`1 ether`;
    const l2TxGasLimit = wei`1000 gwei`;
    const l2TxGasPerPubdataByte = wei`800 wei`;

    await expect(
      l1Erc20Bridge.deposit(
        recipient.address,
        stubs.l1Token.address,
        amount,
        l2TxGasLimit,
        l2TxGasPerPubdataByte,
        sender.address,
        l2Erc20Bridge.address,
        "0x",
        { gasLimit: 10_000_000, value: ethers.utils.parseEther("1.0") }
      )
    ).to.be.reverted;
  });
  it("withdraw() :: withdrawals are disabled", async () => {
    const { l2Erc20Bridge, accounts, stubs } = context;

    const { recipient } = accounts;

    assert.isFalse(await l2Erc20Bridge.isWithdrawalsEnabled());

    const amount = wei`1 ether`;

    await expect(
      l2Erc20Bridge.withdraw(recipient.address, stubs.l2Token.address, amount, {
        gasLimit: 10_000_000,
      })
    ).to.be.reverted;
  });
  it("withdraw() :: wrong L2 token", async () => {
    const { l2Erc20Bridge, accounts, stubs } = context;

    const { deployerWallet, recipient } = accounts;

    await enableWithdrawalsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
    const amount = wei`1 ether`;

    await expect(
      l2Erc20Bridge.withdraw(recipient.address, stubs.l1Token.address, amount, {
        gasLimit: 10_000_000,
      })
    ).to.be.reverted;
  });
  it("withdraw() :: working", async () => {
    const { l2Erc20Bridge, accounts, stubs } = context;

    const { deployerWallet } = accounts;

    await enableWithdrawalsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );

    const recipientBalanceBeforeWith = await stubs.l2Token.balanceOf(
      deployerWallet.address
    );

    const amount = wei`0.5 ether`;

    await expect(
      l2Erc20Bridge.withdraw(
        deployerWallet.address,
        stubs.l2Token.address,
        amount,
        { gasLimit: 10_000_000 }
      )
    )
      .to.emit(l2Erc20Bridge, "WithdrawalInitiated")
      .withArgs(
        deployerWallet.address,
        deployerWallet.address,
        stubs.l2Token.address,
        amount
      );

    const recipientBalanceAfterWith = await stubs.l2Token.balanceOf(
      deployerWallet.address
    );

    expect(recipientBalanceBeforeWith.sub(recipientBalanceAfterWith)).to.eq(
      amount,
      "Change of the recipient balance of L2 token after withdrawal must match withdraw amount"
    );
  });
});

async function initializeBridgesWithAssertion(
  bridge: Contract,
  defaultAdminAddress: string
) {
  const isInitialized = await bridge.isInitialized();

  if (!isInitialized) {
    // grant DEFAULT_ADMIN_ROLE role
    const initTx = await bridge["initialize(address)"](defaultAdminAddress, {
      gasLimit: 10_000_000,
    });
    await initTx.wait();
  }
  assert.isTrue(await bridge.isInitialized());
}

async function enableDepositsWithAssertions(
  l2Erc20Bridge: Contract,
  defaultAdminAddress: string,
  depositEnablerAddress: string
) {
  const isDepositsEnabled = await l2Erc20Bridge.isDepositsEnabled();

  await initializeBridgesWithAssertion(l2Erc20Bridge, defaultAdminAddress);

  if (!isDepositsEnabled) {
    // grant DEPOSITS_ENABLER_ROLE role
    await l2Erc20Bridge.grantRole(
      await l2Erc20Bridge.DEPOSITS_ENABLER_ROLE(),
      depositEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2Erc20Bridge.enableDeposits({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2Erc20Bridge.isDepositsEnabled());
}

async function enableWithdrawalsWithAssertions(
  l2Erc20Bridge: Contract,
  defaultAdminAddress: string,
  withdrawalEnablerAddress: string
) {
  const isWithdrawalsEnabled = await l2Erc20Bridge.isWithdrawalsEnabled();

  await initializeBridgesWithAssertion(l2Erc20Bridge, defaultAdminAddress);

  if (!isWithdrawalsEnabled) {
    // grant WITHDRAWALS_ENABLER_ROLE role
    await l2Erc20Bridge.grantRole(
      await l2Erc20Bridge.WITHDRAWALS_ENABLER_ROLE(),
      withdrawalEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2Erc20Bridge.enableWithdrawals({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2Erc20Bridge.isWithdrawalsEnabled());
}
