import { utils, BigNumber, ethers } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { AccountingOracleStub } from "../../typechain";
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

export async function tokenRateAndTimestampPacked(tokenRate: BigNumber, blockTimestamp: BigNumber, data: string) {
  return ethers.utils.hexConcat(
    [
      ethers.utils.hexZeroPad(tokenRate.toHexString(), 16),
      ethers.utils.hexZeroPad(blockTimestamp.toHexString(), 5),
      data
    ]
  );
}

export async function refSlotTimestamp(accountingOracle: AccountingOracleStub) {
  const genesisTime = await accountingOracle.GENESIS_TIME();
  const secondsPerSlot = await accountingOracle.SECONDS_PER_SLOT();
  const lastProcessingRefSlot = await accountingOracle.getLastProcessingRefSlot();
  return genesisTime.add(secondsPerSlot.mul(lastProcessingRefSlot));
}

export function getInterfaceID(contractInterface: utils.Interface) {
  let interfaceID = ethers.constants.Zero;
  const functions: string[] = Object.keys(contractInterface.functions);
  for (let i = 0; i < functions.length; i++) {
    interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
  }
  return interfaceID;
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

export function getExchangeRate(decimals: BigNumber, totalPooledEther: BigNumber, totalShares: BigNumber) {
  return (BigNumber.from(10).pow(decimals)).mul(totalPooledEther).div(totalShares);
}

/// token / rate
export function nonRebasableFromRebasableL1(rebasable: BigNumber, totalPooledEther: BigNumber, totalShares: BigNumber) {
  return rebasable
    .mul(totalShares)
    .div(totalPooledEther);
}

/// token * rate
export function rebasableFromNonRebasableL1(rebasable: BigNumber, totalPooledEther: BigNumber, totalShares: BigNumber) {
  return rebasable
    .mul(totalPooledEther)
    .div(totalShares);
}

export function nonRebasableFromRebasableL2(rebasable: BigNumber, decimals: BigNumber, exchangeRate: BigNumber) {
  return rebasable
    .mul(BigNumber.from(10).pow(decimals))
    .div(exchangeRate);
}

export function rebasableFromNonRebasableL2(nonRebasable: BigNumber, decimals: BigNumber, exchangeRate: BigNumber) {
  return nonRebasable
    .mul(exchangeRate)
    .div(BigNumber.from(10).pow(decimals));
}

export function almostEqual(num1: BigNumber, num2: BigNumber) {
  const delta = (num1.sub(num2)).abs();
  return delta.lte(BigNumber.from('2'));
}
