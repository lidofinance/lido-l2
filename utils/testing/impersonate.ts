import hre from "hardhat";
import { providers } from "ethers";

export async function impersonate(
  address: string,
  provider?: providers.JsonRpcProvider
) {
  provider ||= hre.ethers.provider;

  await provider.send("hardhat_impersonateAccount", [address]);
  return provider.getSigner(address);
}
