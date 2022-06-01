import hre from "hardhat";

export async function impersonate(address: string) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return await hre.ethers.getSigner(address);
}
