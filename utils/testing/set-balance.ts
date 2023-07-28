import hre from "hardhat";
import { BigNumber, providers } from "ethers";

export async function setBalance(
  address: string,
  balance: BigNumber,
  provider?: providers.JsonRpcProvider
) {
  provider ||= hre.ethers.provider;

  await provider.send("hardhat_setBalance", [
    address,
    "0x" + balance.toBigInt().toString(16),
  ]);
}
