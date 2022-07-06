import hre from "hardhat";
import { providers, Wallet } from "ethers";
import { getContractAddress } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import env from "./env";

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

export function getProvider(rpcURL: string) {
  return new providers.JsonRpcProvider(rpcURL);
}

export function getDeployer(rpcURL: string) {
  const PRIVATE_KEY = env.string("PRIVATE_KEY");
  return new Wallet(PRIVATE_KEY, getProvider(rpcURL));
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

function loadAccount(rpcURL: string, accountPrivateKeyName: string) {
  const privateKey = env.string(accountPrivateKeyName);
  return new Wallet(privateKey, getProvider(rpcURL));
}

type L2Protocol = "arbitrum" | "optimism";
export type Network = "local" | "testnet" | "mainnet";

export interface ChainNetwork {
  signer: Wallet;
  networkName: string;
  network: HttpNetworkConfig;
  provider: JsonRpcProvider;
}

export interface MultiChainNetwork {
  l1: ChainNetwork;
  l2: ChainNetwork;
}

function getMultichainNetwork(
  l2Protocol: L2Protocol,
  network: Network = env.network(),
  signerPK: string = env.privateKey()
): MultiChainNetwork {
  const networks = {
    arbitrum: {
      local: ["local", "local_arbitrum"],
      testnet: ["rinkeby", "rinkeby_arbitrum"],
      mainnet: ["mainnet", "mainnet_arbitrum"],
    },
    optimism: {
      local: ["local", "local_optimism"],
      testnet: ["kovan", "kovan_optimism"],
      mainnet: ["mainnet", "mainnet_optimism"],
    },
  };

  const [l1NetworkName, l2NetworkName] = networks[l2Protocol][network];
  const l1Network = getNetworkConfig(l1NetworkName, hre);
  const l2Network = getNetworkConfig(l2NetworkName, hre);
  const l1Provider = getProvider(l1Network.url);
  const l2Provider = getProvider(l2Network.url);
  return {
    l1: {
      network: l1Network,
      provider: l1Provider,
      networkName: l1NetworkName,
      signer: new Wallet(signerPK, l1Provider),
    },
    l2: {
      network: l2Network,
      provider: l2Provider,
      networkName: l2NetworkName,
      signer: new Wallet(signerPK, l2Provider),
    },
  };
}

export default {
  loadAccount,
  getDeployer,
  getConfig: getNetworkConfig,
  getMultichainNetwork,
  predictAddresses,
};
