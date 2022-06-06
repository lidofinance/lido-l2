import { providers, Wallet } from "ethers";
import { getEnvVariable } from "../env";
import { getContractAddress } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

export function getNetworkConfig(
  networkName: string,
  hre: HardhatRuntimeEnvironment
) {
  const config = hre.config.networks[networkName];
  if (!config) {
    throw new Error(
      `Network with name ${networkName} not found. Check your hardhat.config.ts file contains network with given name`
    );
  }
  return config as HttpNetworkConfig;
}

export function getProvider(
  networkName: string,
  hre: HardhatRuntimeEnvironment
) {
  const config = getNetworkConfig(networkName, hre);
  return new providers.JsonRpcProvider(config.url);
}

export function getDeployer(
  networkName: string,
  hre: HardhatRuntimeEnvironment
) {
  const PRIVATE_KEY = getEnvVariable("PRIVATE_KEY");
  return new Wallet(PRIVATE_KEY, getProvider(networkName, hre));
}

// predicts future addresses of the contracts deployed by account
export async function predictAddresses(account: Wallet, txsCount: number) {
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
