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

export const E2E_TEST_CONTRACTS_MANTLE = {
  l1: {
    l1Token: "0x6320cD32aA674d2898A68ec82e869385Fc5f7E2f",
    l1LDOToken: "0xcAdf242b97BFdD1Cb4Fd282E5FcADF965883065f",
    l1ERC20TokenBridge: "0x67fa6217C48BAd4777BF2C742c728a7200CE971E",
    aragonVoting: "0xfDdA522eF6626e155d47Be0aeF74c204CfB3d2c4",
    tokenManager: "0xF3BfaD8a6960ad130e02c9d14262788dea2C3Cd5",
    agent: "0x45B1F6E7ABFf8A8bf516554634Abf37D73C79fBC",
    l1CrossDomainMessenger: "0x7Bfe603647d5380ED3909F6f87580D0Af1B228B4",
  },
  l2: {
    l2Token: "0xf53f81Ef9F9291Ce714d5691edb13b40C31F8781",
    l2ERC20TokenBridge: "0x081299187587cBA30Bc29f4Ac4a4c6987C575f5f",
    govBridgeExecutor: "0x970Dcbd7eA1fd378462Ef0C82B0BE7f2083DD7fE",
  },
};


export const E2E_TEST_CONTRACTS_ARBITRUM = {
  l1: {
    l1Token: "0x7AEE39c46f20135114e85A03C02aB4FE73fB8127",
    l1GatewayRouter: "0xa2a8F940752aDc4A3278B63B96d56D72D2b075B1",
    l1ERC20TokenGateway: "0x46b10f1E65f19876F50bfdD59C9B39E9De6B9150",
    aragonVoting: "0x04F9590D3EEC8e619D7714ffeF664aD3fd53b880",
    tokenManager: "0x1ee7e87486f9ae6e27a5e58310a5319394360cf0",
    agent: "0x12869c3349f993c5c20bab9482b7d16aff0ae2f9",
    l1LDOToken: "0x84b4c77b260910fc02dddac41ef0e45e658b18af",
    inbox: "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e",
  },
  l2: {
    l2Token: "0x57FA50b80f79b9140fe7249A93D432d9fa8C4192",
    l2GatewayRouter: "0x57f54f87C44d816f60b92864e23b8c0897D4d81D",
    l2ERC20TokenGateway: "0xD06491e4C8B3107B83dC134894C4c96ED8ddbfa2",
    govBridgeExecutor: "0x4e8CC9024Ea3FE886623025fF2aD0CA4bb3D1F42",
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

export const createMantleVoting = async (
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

export const createArbitrumVoting = async (
  ctx: any,
  executorCalldata: string,
  options: Record<string, any> = {}
) => {
  const messageCalldata = await ctx.inbox.interface.encodeFunctionData(
    "createRetryableTicket",
    [
      ctx.govBridgeExecutor.address,
      0,
      options.maxSubmissionCost || wei`0.01 ether`,
      ctx.l2Tester.address,
      ctx.l2Tester.address,
      options.maxGas || 3000000,
      options.gasPriceBid || 5000000000,
      executorCalldata,
    ]
  );

  const agentCalldata = ctx.agent.interface.encodeFunctionData("execute", [
    ctx.inbox.address,
    options.callValue || wei`0.01 ether`,
    messageCalldata,
  ]);
  const agentEvmScript = encodeEVMScript(ctx.agent.address, agentCalldata);

  const newVoteCalldata =
    "0xd5db2c80" +
    abiCoder.encode(["bytes", "string"], [agentEvmScript, ""]).substring(2);
  const votingEvmScript = encodeEVMScript(ctx.voting.address, newVoteCalldata);
  const newVotingTx = await ctx.tokenMnanager.forward(votingEvmScript);

  await newVotingTx.wait();
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
