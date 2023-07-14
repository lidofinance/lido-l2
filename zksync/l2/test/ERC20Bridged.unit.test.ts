import hre from "hardhat";
import { assert, expect } from "chai";
import { Wallet, Provider, Contract } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, BigNumber } from "ethers";
import { describe } from "mocha";

import { richWallet } from "../../l1/scripts/utils/rich_wallet";
import { domainSeparator } from "./utils/eip712";
import {
  PROVIDER_URL,
  CHAIN_ID,
  L2_TOKEN_NAME,
  L2_TOKEN_SYMBOL,
  L2_TOKEN_DECIMALS,
  L2_TOKEN_SINGING_DOMAIN_VERSION,
} from "./utils/constants";

const INITIAL_BALANCE = ethers.utils.parseEther("10");

const types: Record<string, ethers.TypedDataField[]> = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

describe("ZkSync :: ERC20Bridged", async () => {
  async function setup() {
    const provider = new Provider(PROVIDER_URL);

    const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
    const governor = new Wallet(richWallet[1].privateKey, provider);
    const initialHolder = new Wallet(richWallet[2].privateKey, provider);
    const spender = new Wallet(richWallet[3].privateKey, provider);
    const erc1271WalletOwner = new Wallet(richWallet[4].privateKey, provider);

    const deployer = new Deployer(hre, deployerWallet);

    const ossifiableProxyArtifact = await deployer.loadArtifact(
      "OssifiableProxy"
    );

    // L2 token
    const erc20BridgedArtifact = await deployer.loadArtifact(
      "ERC20BridgedUpgradeable"
    );
    const erc20BridgedContract = await deployer.deploy(
      erc20BridgedArtifact,
      []
    );
    const erc20BridgedImpl = await erc20BridgedContract.deployed();

    // proxy
    const erc20BridgedProxyContract = await deployer.deploy(
      ossifiableProxyArtifact,
      [erc20BridgedImpl.address, governor.address, "0x"]
    );
    const erc20BridgedProxy = await erc20BridgedProxyContract.deployed();

    const erc20Bridged = new Contract(
      erc20BridgedProxy.address,
      erc20BridgedArtifact.abi,
      deployer.zkWallet
    );

    const initTx = await erc20Bridged[
      "__ERC20BridgedUpgradeable_init(string,string,uint8)"
    ](L2_TOKEN_NAME, L2_TOKEN_SYMBOL, L2_TOKEN_DECIMALS);
    await initTx.wait();

    const initV2Tx = await erc20Bridged[
      "__ERC20BridgedUpgradeable_init_v2(address)"
    ](deployerWallet.address);
    await initV2Tx.wait();

    const erc1271WalletArtifact = await deployer.loadArtifact(
      "ERC1271WalletStub"
    );

    const erc1271WalletContract = await deployer.deploy(erc1271WalletArtifact, [
      erc1271WalletOwner.address,
    ]);
    await erc1271WalletContract.deployed();

    // mint initial balance to initialHolder wallet
    await (
      await erc20Bridged.bridgeMint(initialHolder.address, INITIAL_BALANCE)
    ).wait();

    // mint initial balance to smart contract wallet
    await (
      await erc20Bridged.bridgeMint(
        erc1271WalletContract.address,
        INITIAL_BALANCE
      )
    ).wait();

    return {
      accounts: {
        deployerWallet,
        governor,
        initialHolder,
        spender,
        erc1271WalletOwner,
      },
      erc20Bridged,
      erc1271Wallet: erc1271WalletContract,
      domain: {
        name: L2_TOKEN_NAME,
        version: L2_TOKEN_SINGING_DOMAIN_VERSION,
        chainId: CHAIN_ID,
        verifyingContract: erc20Bridged.address,
      },
      gasLimit: 10_000_000,
    };
  }

  let context: Awaited<ReturnType<typeof setup>>;

  before("Setting up the context", async () => {
    context = await setup();
  });

  it("nonces() :: initial nonce is 0", async () => {
    const {
      accounts: { initialHolder },
      erc20Bridged,
    } = context;
    assert.deepEqual(
      await erc20Bridged.nonces(initialHolder.address),
      ethers.utils.parseEther("0")
    );
  });

  it("DOMAIN_SEPARATOR()", async () => {
    const { erc20Bridged } = context;
    assert.equal(
      await erc20Bridged.DOMAIN_SEPARATOR(),
      domainSeparator(
        L2_TOKEN_NAME,
        L2_TOKEN_SINGING_DOMAIN_VERSION,
        CHAIN_ID,
        erc20Bridged.address
      )
    );
  });

  it("permit() :: EOA :: works as expected", async () => {
    const {
      accounts: { initialHolder, spender },
      erc20Bridged,
      domain,
    } = context;

    const ownerAddr = initialHolder.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 0;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await initialHolder._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    const permitTx = await erc20Bridged.permit(
      ownerAddr,
      spenderAddrs,
      amount,
      deadline,
      v,
      r,
      s
    );
    await permitTx.wait();

    assert.deepEqual(
      await erc20Bridged.nonces(ownerAddr),
      BigNumber.from(1),
      "Incorrect owner nonce"
    );

    assert.deepEqual(
      await erc20Bridged.allowance(ownerAddr, spenderAddrs),
      amount,
      "Incorrect spender allowance"
    );
  });

  it("permit() :: EOA :: rejects reused signature", async () => {
    const {
      accounts: { initialHolder, spender },
      erc20Bridged,
      domain,
    } = context;

    const ownerAddr = initialHolder.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 0;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await initialHolder._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWith("ERC20Permit: invalid signature");
  });

  it("permit() :: EOA :: rejects invalid signer", async () => {
    const {
      accounts: { initialHolder, spender, deployerWallet: invalidSigner },
      erc20Bridged,
      domain,
    } = context;

    const ownerAddr = initialHolder.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 1;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await invalidSigner._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWith("ERC20Permit: invalid signature");
  });

  it("permit() :: EOA :: rejects expired permit deadline", async () => {
    const {
      accounts: { initialHolder, spender },
      erc20Bridged,
      domain,
    } = context;

    const ownerAddr = initialHolder.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 1;
    const deadline = Math.floor(Date.now() / 1000) - 604_800; // 1 week = 604_800 s

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await initialHolder._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWithCustomError(erc20Bridged, "ERC2612ExpiredSignature");
  });

  it("permit() :: ERC1271Wallet :: works as expected", async () => {
    const {
      accounts: { spender, erc1271WalletOwner },
      erc20Bridged,
      erc1271Wallet,
      domain,
    } = context;

    const ownerAddr = erc1271Wallet.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 0;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await erc1271WalletOwner._signTypedData(
      domain,
      types,
      value
    );
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    const permitTx = await erc20Bridged.permit(
      ownerAddr,
      spenderAddrs,
      amount,
      deadline,
      v,
      r,
      s
    );
    await permitTx.wait();

    assert.deepEqual(
      await erc20Bridged.nonces(ownerAddr),
      BigNumber.from(1),
      "Incorrect owner nonce"
    );

    assert.deepEqual(
      await erc20Bridged.allowance(ownerAddr, spenderAddrs),
      amount,
      "Incorrect spender allowance"
    );
  });

  it("permit() :: ERC1271Wallet :: rejects reused signature", async () => {
    const {
      accounts: { spender, erc1271WalletOwner },
      erc20Bridged,
      erc1271Wallet,
      domain,
    } = context;

    const ownerAddr = erc1271Wallet.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 0;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await erc1271WalletOwner._signTypedData(
      domain,
      types,
      value
    );
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWith("ERC20Permit: invalid signature");
  });

  it("permit() :: ERC1271Wallet :: rejects invalid signer", async () => {
    const {
      accounts: { spender, deployerWallet: invalidSigner },
      erc20Bridged,
      erc1271Wallet,
      domain,
    } = context;

    const ownerAddr = erc1271Wallet.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 1;
    const deadline = ethers.constants.MaxUint256;

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await invalidSigner._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWith("ERC20Permit: invalid signature");
  });

  it("permit() :: ERC1271Wallet :: rejects expired permit deadline", async () => {
    const {
      accounts: { spender, erc1271WalletOwner },
      erc20Bridged,
      erc1271Wallet,
      domain,
    } = context;

    const ownerAddr = erc1271Wallet.address;
    const spenderAddrs = spender.address;
    const amount = ethers.utils.parseEther("1");
    const ownerNonce = 1;
    const deadline = Math.floor(Date.now() / 1000) - 604_800; // 1 week = 604_800 s

    const value = {
      owner: ownerAddr,
      spender: spenderAddrs,
      value: amount,
      nonce: ownerNonce,
      deadline,
    };

    const signature = await erc1271WalletOwner._signTypedData(
      domain,
      types,
      value
    );
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = "0x" + signature.slice(130, 132);

    await expect(
      erc20Bridged.permit(ownerAddr, spenderAddrs, amount, deadline, v, r, s)
    ).to.be.revertedWithCustomError(erc20Bridged, "ERC2612ExpiredSignature");
  });
});
