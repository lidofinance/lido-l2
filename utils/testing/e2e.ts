import { AddressLike } from "@eth-optimism/sdk";
import { ethers } from "hardhat";
import { wei } from "../wei";

const abiCoder = ethers.utils.defaultAbiCoder;

export const E2E_TEST_CONTRACTS_OPTIMISM = {
  l1: {
    l1Token: "0xaF8a2F0aE374b03376155BF745A3421Dac711C12",
    l1LDOToken: "0xcAdf242b97BFdD1Cb4Fd282E5FcADF965883065f",
    l1ERC20TokenBridge: "0x2DD0CD60b6048549ab576f06BC20EC53B457244E",
    aragonVoting: "0x86f4C03aB9fCE83970Ce3FC7C23f25339f484EE5",
    tokenManager: "0x4A63e41611B7c70DA6f42a806dFBcECB0B2D314F",
    agent: "0x80720229bdB8caf9f67ddf871e98a76655A39AFe",
    l1CrossDomainMessenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD",
  },
  l2: {
    l2Token: "0x4c2ECf847C89d5De3187F1b0081E4dcdBe063C68",
    l2ERC20TokenBridge: "0x0A5c6AB7B41E066b5C40907dd06063703be21B19",
    govBridgeExecutor: "0x2365F00fFD70958EC2c20B601D501e4b75798D93",
  },
};

export const createOptimismVoting = async (
  ctx: any,
  executorCalldata: string
) => {
  const messageCalldata =
    await ctx.l1CrossDomainMessenger.interface.encodeFunctionData(
      "sendMessage",
      [ctx.govBridgeExecutor.address, executorCalldata, 1000000]
    );
  const messageEvmScript = encodeEVMScript(
    ctx.l1CrossDomainMessenger.address,
    messageCalldata
  );

  const agentCalldata = ctx.agent.interface.encodeFunctionData("forward", [
    messageEvmScript,
  ]);
  const agentEvmScript = encodeEVMScript(ctx.agent.address, agentCalldata);

  const newVoteCalldata =
    "0xd5db2c80" +
    abiCoder.encode(["bytes", "string"], [agentEvmScript, ""]).substring(2);
  const votingEvmScript = encodeEVMScript(ctx.voting.address, newVoteCalldata);

  const newVotingTx = await ctx.tokenMnanager.forward(votingEvmScript);

  await newVotingTx.wait();
};

export const encodeEVMScript = (
  target: AddressLike,
  messageCalldata: string
) => {
  const calldataLength = abiCoder
    .encode(["uint256"], [Math.trunc(messageCalldata.length / 2) - 1])
    .substring(58);
  return (
    "0x00000001" +
    target.substring(2) +
    calldataLength +
    messageCalldata.substring(2)
  );
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
