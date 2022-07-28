import hre from "hardhat";
import { Wallet, BigNumber } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

const PRIVATE_KEYS = {
  deployer:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  sender: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  recipient:
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

export default {
  privateKeys: PRIVATE_KEYS,
  sender(provider: JsonRpcProvider) {
    return new Wallet(PRIVATE_KEYS.sender, provider);
  },
  deployer(provider: JsonRpcProvider) {
    return new Wallet(PRIVATE_KEYS.deployer, provider);
  },
  recipient(provider: JsonRpcProvider) {
    return new Wallet(PRIVATE_KEYS.recipient, provider);
  },
  async impersonate(address: string, provider?: JsonRpcProvider) {
    provider ||= hre.ethers.provider;

    await provider.send("hardhat_impersonateAccount", [address]);
    return provider.getSigner(address);
  },
  applyL1ToL2Alias(address: string) {
    const offset = "0x1111000000000000000000000000000000001111";
    const mask = BigNumber.from(2).pow(160);
    return hre.ethers.utils.getAddress(
      hre.ethers.BigNumber.from(address).add(offset).mod(mask).toHexString()
    );
  },
};
