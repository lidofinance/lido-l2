import { providers } from "ethers";
import hre from "hardhat";
// import { EthereumProvider } from "hardhat/types";

export async function impersonate(
  address: string,
  provider?: providers.JsonRpcProvider
) {
  provider ||= hre.ethers.provider;

  await provider.send("hardhat_impersonateAccount", [address]);
  return provider.getSigner(address);
}
