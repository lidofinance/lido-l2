import hre from "hardhat";
import { providers, Signer, Wallet } from "ethers";
import { getContractAddress } from "ethers/lib/utils";
import { JsonRpcProvider, Provider } from "@ethersproject/providers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import env from "./env";

export type ChainId = 1 | 4 | 31337;
export type SignerOrProvider = Signer | Provider;

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
export type NetworkName =
  | "mainnet"
  | "testnet"
  | "local_mainnet"
  | "local_testnet";

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

const NETWORK_BINDINGS = {
  arbitrum: {
    local_mainnet: ["local_eth_mainnet", "local_arb_mainnet"],
    local_testnet: ["local_eth_rinkeby", "local_arb_rinkeby"],
    testnet: ["eth_rinkeby", "arb_rinkeby"],
    mainnet: ["eth_mainnet", "arb_mainnet"],
  },
  optimism: {
    local_mainnet: ["local_eth_mainnet", "local_opt_mainnet"],
    local_testnet: ["local_eth_kovan", "local_opt_kovan"],
    testnet: ["eth_kovan", "opt_kovan"],
    mainnet: ["eth_mainnet", "opt_mainnet"],
  },
};

function getMultichainNetwork(
  l2Protocol: L2Protocol,
  network: NetworkName = env.network(),
  signerPK: string = env.privateKey()
) {
  const [l1NetworkName, l2NetworkName] = NETWORK_BINDINGS[l2Protocol][network];
  const l1Network = getNetworkConfig(l1NetworkName, hre);
  const l2Network = getNetworkConfig(l2NetworkName, hre);
  const l1Provider = getProvider(l1Network.url);
  const l2Provider = getProvider(l2Network.url);
  return {
    l1Network,
    l1Provider,
    l1NetworkName,
    l1Signer: new Wallet(signerPK, l1Provider),
    l2Network,
    l2Provider,
    l2NetworkName,
    l2Signer: new Wallet(signerPK, l2Provider),
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

function getMultiChainNetwork(
  l2Protocol: L2Protocol,
  networkName: NetworkName
) {
  const [l1NetworkName, l2NetworkName] =
    NETWORK_BINDINGS[l2Protocol][networkName];
  return [
    getNetworkConfig(l1NetworkName, hre),
    getNetworkConfig(l2NetworkName, hre),
  ];
}

function getMultiChainProvider(
  l2Protocol: L2Protocol,
  networkName: NetworkName
) {
  const [l1Network, l2Network] = getMultiChainNetwork(l2Protocol, networkName);
  return [getProvider(l1Network.url), getProvider(l2Network.url)];
}

function getMultiChainSigner(
  l2Protocol: L2Protocol,
  networkName: NetworkName,
  privateKey: string
) {
  const [l1Provider, l2Provider] = getMultiChainProvider(
    l2Protocol,
    networkName
  );
  return [
    new Wallet(privateKey, l1Provider),
    new Wallet(privateKey, l2Provider),
  ];
}

export default {
  loadAccount,
  getDeployer,
  getConfig: getNetworkConfig,
  getMultichainNetwork,
  predictAddresses,
  getProvider,
  getMultiChainProvider,
  getMultiChainSigner,
};
