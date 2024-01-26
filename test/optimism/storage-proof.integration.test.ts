import { assert } from "chai";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { ERC20WrappableStub } from "../../typechain";
import { RLP } from "ethers/lib/utils";

scenario("Optimism :: Bridging integration test", ctxFactory)
  .after(async (ctx) => {
    await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
    await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
  })

  .step("Activate bridging on L1", async (ctx) => {
    const { l1ERC20TokenBridge } = ctx;
    const { l1ERC20TokenBridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l1ERC20TokenBridge.isDepositsEnabled();
    console.log("1_");

    if (!isDepositsEnabled) {
      await l1ERC20TokenBridge
        .connect(l1ERC20TokenBridgeAdmin)
        .enableDeposits();
    } else {
      console.log("L1 deposits already enabled");
    }
    console.log("2_");
    const isWithdrawalsEnabled =
      await l1ERC20TokenBridge.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l1ERC20TokenBridge
        .connect(l1ERC20TokenBridgeAdmin)
        .enableWithdrawals();
    } else {
      console.log("L1 withdrawals already enabled");
    }

    assert.isTrue(await l1ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l1ERC20TokenBridge.isWithdrawalsEnabled());
  })

  .step("Activate bridging on L2", async (ctx) => {
    const { l2ERC20TokenBridge } = ctx;
    const { l2ERC20TokenBridgeAdmin } = ctx.accounts;

    const isDepositsEnabled = await l2ERC20TokenBridge.isDepositsEnabled();

    if (!isDepositsEnabled) {
      await l2ERC20TokenBridge
        .connect(l2ERC20TokenBridgeAdmin)
        .enableDeposits();
    } else {
      console.log("L2 deposits already enabled");
    }

    const isWithdrawalsEnabled =
      await l2ERC20TokenBridge.isWithdrawalsEnabled();

    if (!isWithdrawalsEnabled) {
      await l2ERC20TokenBridge
        .connect(l2ERC20TokenBridgeAdmin)
        .enableWithdrawals();
    } else {
      console.log("L2 withdrawals already enabled");
    }

    assert.isTrue(await l2ERC20TokenBridge.isDepositsEnabled());
    assert.isTrue(await l2ERC20TokenBridge.isWithdrawalsEnabled());
  })

  .step("Set up Token Rate Oracle by pushing first rate", async (ctx) => {

    const {
        l1Token,
        l1TokenRebasable,
        l2TokenRebasable,
        l1ERC20TokenBridge,
        l2CrossDomainMessenger,
        l2ERC20TokenBridge,
        l2Provider
      } = ctx;

    const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } =
      ctx.accounts;
    const dataToReceive = await packedTokenRateAndTimestamp(l2Provider, l1Token);

    const tx = await l2CrossDomainMessenger
    .connect(l1CrossDomainMessengerAliased)
    .relayMessage(
      1,
      l1ERC20TokenBridge.address,
      l2ERC20TokenBridge.address,
      0,
      300_000,
      l2ERC20TokenBridge.interface.encodeFunctionData("finalizeDeposit", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        0,
        dataToReceive,
      ]),
      { gasLimit: 5_000_000 }
    );
  })

  .step("Test Token Rate Updater", async (ctx) => {
    // get proof parameteres from oracle updater

    const params = await ctx.tokenRateUpdater.getProofParams();
    console.log("params=",params);

    const {
        l1Provider,
        l2Provider
      } = ctx;

    const steth_address = params[0];
    const steth_slots = params.slice(1, 6);

    console.log("steth_address=",steth_address);
    console.log("steth_slots=",steth_slots);

    const hex_slots = steth_slots.map((x) => ethers.utils.hexlify(x));

    console.log("hex_slots=",hex_slots);
    console.log("l1Provider.blockNumber=", l1Provider.blockNumber);


    const par = [steth_address.toLowerCase(), hex_slots, ethers.utils.hexlify(l1Provider.blockNumber - 1000)];
    console.log("par=",par);

    // request proof from L1
    const result = await l1Provider.send("eth_getProof", par);
    console.log("result=",result);


    const proof_data = result["accountProof"];

    const account_proof = decode_rpc_proof(proof_data);
    console.log("account_proof=",account_proof);


    const storage_proofs = result["storageProof"].map((slot_data) => decode_rpc_proof(slot_data["proof"]));
    console.log("storage_proofs=",storage_proofs);


    const block_header = await request_block_header(l1Provider, l1Provider.blockNumber - 1000);

    const header_blob = RLP.encode(block_header);
    console.log("header_blob=",header_blob);

    const proofs_blob = RLP.encode(account_proof.concat(storage_proofs));
    console.log("proofs_blob=",proofs_blob);

    const res = await ctx.tokenRateUpdater.connect(ctx.accounts.l2ERC20TokenBridgeAdmin).submitState(header_blob, proofs_blob, {
        gasLimit: 3000000
    });
    console.log("res=",res);

    // const storage_proofs = [
    //     decode_rpc_proof(slot_data["proof"]) for slot_data in result["storageProof"]
    // ]

    // const x = ethers.utils.toUtf8Bytes("1234");

    // const y = ethers.utils.hexConcat([1,2,3,4]);
    // console.log("y=",y);


    // ethers.utils.parseBytes32String
    // const account_proof = proof_data.map((node) => ethers.utils.toUtf8Bytes(node.toString()));
    // console.log("account_proof=",account_proof);

    // export function decode(data: BytesLike): any {


    // ethers.utils.hexZeroPad
    //   def decode_rpc_proof(proof_data):
    //   return [rlp.decode(decode_hex(node)) for node in proof_data]
    // submit state to oracle updater
    // call updateRate()
  })


  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");

  console.log("1");

  const {
    l1Provider,
    l2Provider,
    l1ERC20TokenBridgeAdmin,
    l2ERC20TokenBridgeAdmin,
    ...contracts
  } = await optimism.testing(networkName).getIntegrationTestSetup();
  console.log("2");

  const l1Snapshot = await l1Provider.send("evm_snapshot", []);
  const l2Snapshot = await l2Provider.send("evm_snapshot", []);

  console.log("3");

  await optimism.testing(networkName).stubL1CrossChainMessengerContract();
  console.log("4");

  const accountA = testing.accounts.accountA(l1Provider, l2Provider);
  const accountB = testing.accounts.accountB(l1Provider, l2Provider);

  const exchangeRate = 2;
  const depositAmountNonRebasable = wei`0.15 ether`;
  const depositAmountRebasable = wei.toBigNumber(depositAmountNonRebasable).mul(exchangeRate);

  const withdrawalAmountNonRebasable = wei`0.05 ether`;
  const withdrawalAmountRebasable = wei.toBigNumber(withdrawalAmountNonRebasable).mul(exchangeRate);

  await testing.setBalance(
    await contracts.l1TokensHolder.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  await testing.setBalance(
    await l1ERC20TokenBridgeAdmin.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l1Provider
  );

  await testing.setBalance(
    await l2ERC20TokenBridgeAdmin.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  await contracts.l1TokenRebasable
    .connect(contracts.l1TokensHolder)
    .transfer(accountA.l1Signer.address, depositAmountRebasable);

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
    l2Provider
  );

  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );
  console.log("5");

  await contracts.l1ERC20TokenBridge.connect(l1ERC20TokenBridgeAdmin).pushTokenRate(1000000);

  return {
    l1Provider,
    l2Provider,
    ...contracts,
    accounts: {
      accountA,
      accountB,
      l1Stranger: testing.accounts.stranger(l1Provider),
      l1ERC20TokenBridgeAdmin,
      l2ERC20TokenBridgeAdmin,
      l1CrossDomainMessengerAliased,
    },
    common: {
      depositAmountNonRebasable,
      depositAmountRebasable,
      withdrawalAmountNonRebasable,
      withdrawalAmountRebasable,
      exchangeRate,
    },
    snapshot: {
      l1: l1Snapshot,
      l2: l2Snapshot,
    },
  };
}

async function packedTokenRateAndTimestamp(l1Provider: JsonRpcProvider, l1Token: ERC20WrappableStub) {
    const stETHPerToken = await l1Token.stETHPerToken();
    const blockNumber = await l1Provider.getBlockNumber();
    const blockTimestamp = (await l1Provider.getBlock(blockNumber)).timestamp;
    const stETHPerTokenStr = ethers.utils.hexZeroPad(stETHPerToken.toHexString(), 12);
    const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);
    return ethers.utils.hexConcat([stETHPerTokenStr, blockTimestampStr]);
}


function decode_rpc_proof(proof_data: [string]) {
    return proof_data.map((node) => RLP.decode(ethers.utils.hexlify(node)));
}


async function request_block_header(provider: JsonRpcProvider, block_number: Number) {
    const block_dict = await provider.send("eth_getBlockByNumber", [block_number, true]);
    console.log("block_dict=",block_dict);

    const BLOCK_HEADER_FIELDS = [
        "parentHash", "sha3Uncles", "miner", "stateRoot", "transactionsRoot",
        "receiptsRoot", "logsBloom", "difficulty", "number", "gasLimit",
        "gasUsed", "timestamp", "extraData", "mixHash", "nonce"
    ]
    // ethers.utils.formatBytes32String

    const block_header_fields = BLOCK_HEADER_FIELDS.map((f) => ethers.utils.toUtf8Bytes(block_dict[f]));
    console.log("block_header_fields=", block_header_fields);
    return block_header_fields
}


    // block_dict = get_json_rpc_result(r)
    // block_number = normalize_int(block_dict["number"])
    // block_header_fields = [normalize_bytes(block_dict[f]) for f in BLOCK_HEADER_FIELDS]

    // return (block_number, block_header_fields)
