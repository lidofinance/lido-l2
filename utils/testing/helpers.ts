import { utils, BigNumber, ethers } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { ERC20WrapperStub, AccountingOracleStub } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getContractAddress } from "ethers/lib/utils";

export async function getContractTransactionTimestamp(provider: JsonRpcProvider, tx: ContractTransaction) {
  const contractReceipt = await tx.wait();
  return BigNumber.from((await provider.getBlock(contractReceipt.blockNumber)).timestamp);
}

export async function getBlockTimestamp(provider: JsonRpcProvider, secondsToShift: number) {
  const blockNumber = await provider.getBlockNumber();
  return BigNumber.from((await provider.getBlock(blockNumber)).timestamp + secondsToShift);
}

export function getInterfaceID(contractInterface: utils.Interface) {
  let interfaceID = ethers.constants.Zero;
  const functions: string[] = Object.keys(contractInterface.functions);
  for (let i = 0; i < functions.length; i++) {
    interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
  }
  return interfaceID;
}

export async function packedTokenRateAndTimestamp(provider: JsonRpcProvider, l1Token: ERC20WrapperStub) {
  const stEthPerToken = await l1Token.getStETHByWstETH(BigNumber.from(10).pow(27));
  const stEthPerTokenStr = ethers.utils.hexZeroPad(stEthPerToken.toHexString(), 16);

  const blockNumber = await provider.getBlockNumber();
  const blockTimestamp = (await provider.getBlock(blockNumber)).timestamp;
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);

  return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr]);
}

async function packedTokenRateAndTimestamp2(provider: JsonRpcProvider, tokenRate: BigNumber) {
  const stEthPerTokenStr = ethers.utils.hexZeroPad(tokenRate.toHexString(), 16);

  const blockNumber = await provider.getBlockNumber();
  const blockTimestamp = (await provider.getBlock(blockNumber)).timestamp;
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);

  return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr]);
}

export async function packedTokenRateAndTimestampForL1Bridge(
  l1Token: ERC20WrapperStub,
  accountingOracle: AccountingOracleStub
) {
  const stEthPerToken = await l1Token.getStETHByWstETH(BigNumber.from(10).pow(27));
  const stEthPerTokenStr = ethers.utils.hexZeroPad(stEthPerToken.toHexString(), 16);

  const genesisTime = await accountingOracle.GENESIS_TIME();
  const secondsPerSlot = await accountingOracle.SECONDS_PER_SLOT();
  const lastProcessingRefSlot = await accountingOracle.lastProcessingRefSlot();
  const refSlotTimestamp = genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(refSlotTimestamp), 5);

  return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr]);
}

export async function tokenRateAndTimestamp(tokenRate: BigNumber, blockTimestamp: BigNumber) {
  const stEthPerTokenStr = ethers.utils.hexZeroPad(tokenRate.toHexString(), 16);
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);
  return [stEthPerTokenStr, blockTimestampStr];
}

export async function tokenRateAndTimestampPacked(tokenRate: BigNumber, blockTimestamp: BigNumber, data: string) {
  const stEthPerTokenStr = ethers.utils.hexZeroPad(tokenRate.toHexString(), 16);
  const blockTimestampStr = ethers.utils.hexZeroPad(ethers.utils.hexlify(blockTimestamp), 5);
  return ethers.utils.hexConcat([stEthPerTokenStr, blockTimestampStr, data]);
}

export async function refSlotTimestamp(accountingOracle: AccountingOracleStub) {
  const genesisTime = await accountingOracle.GENESIS_TIME();
  const secondsPerSlot = await accountingOracle.SECONDS_PER_SLOT();
  const lastProcessingRefSlot = await accountingOracle.getLastProcessingRefSlot();
  return genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));
}

export async function predictAddresses(account: SignerWithAddress, txsCount: number) {
  const currentNonce = await account.getTransactionCount();

  const res: string[] = [];
  for (let i = 0; i < txsCount; ++i) {
    res.push(
      getContractAddress({
        from: account.address,
        nonce: currentNonce + i,
      })
    );
  }
  return res;
}
