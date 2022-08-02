import hre from "hardhat";
import { providers, Signer, Wallet } from "ethers";
import { getContractAddress } from "ethers/lib/utils";
import { Provider } from "@ethersproject/providers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import env from "./env";

type ChainNameShort = "arb" | "opt" | "eth";
export type NetworkName = "goerli" | "mainnet" | "rinkeby" | "kovan";
export type SignerOrProvider = Signer | Provider;

const HARDHAT_NETWORK_NAMES = {
  eth: {
    goerli: "eth_goerli",
    mainnet: "eth_mainnet",
    kovan: "eth_kovan", // DEPRECATED
    rinkeby: "eth_rinkeby", // DEPRECATED
  },
  arb: {
    goerli: "arb_goerli",
    mainnet: "arb_mainnet",
    rinkeby: "arb_rinkeby", // DEPRECATED
    kovan: "NOT_DEPLOYED", // DEPRECATED
  },
  opt: {
    goerli: "opt_goerli",
    mainnet: "opt_mainnet",
    kovan: "opt_kovan", // DEPRECATED
    rinkeby: "NOT_DEPLOYED", // DEPRECATED
  },
};

const HARDHAT_NETWORK_NAMES_FORK = {
  eth: {
    goerli: "eth_goerli_fork",
    mainnet: "eth_mainnet_fork",
    kovan: "eth_kovan_fork", // DEPRECATED
    rinkeby: "eth_rinkeby_fork", // DEPRECATED
  },
  arb: {
    goerli: "arb_goerli_fork",
    mainnet: "arb_mainnet_fork",
    rinkeby: "arb_rinkeby_fork", // DEPRECATED
    kovan: "NOT_DEPLOYED",
  },
  opt: {
    kovan: "opt_kovan_fork", // DEPRECATED
    goerli: "opt_goerli_fork",
    mainnet: "opt_mainnet_fork",
    rinkeby: "NOT_DEPLOYED",
  },
};

export function getConfig(networkName: string, hre: HardhatRuntimeEnvironment) {
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

export function multichain(
  chainNames: ChainNameShort[],
  networkName: NetworkName
) {
  return {
    getNetworks(options: { forking: boolean }) {
      const hardhatNetworkNames = options.forking
        ? HARDHAT_NETWORK_NAMES_FORK
        : HARDHAT_NETWORK_NAMES;

      const res: HttpNetworkConfig[] = [];
      for (const chainName of chainNames) {
        const hardhatNetworkName = hardhatNetworkNames[chainName][networkName];
        if (hardhatNetworkName === "NOT_DEPLOYED") {
          throw new Error(
            `Chain "${chainName}" doesn't support "${hardhatNetworkName}" network`
          );
        }
        res.push(getConfig(hardhatNetworkName, hre));
      }
      return res;
    },
    getProviders(options: { forking: boolean }) {
      return this.getNetworks(options).map((network) =>
        getProvider(network.url)
      );
    },
    getSigners(privateKey: string, options: { forking: boolean }) {
      return this.getProviders(options).map(
        (provider) => new Wallet(privateKey, provider)
      );
    },
  };
}

function getChainId(networkName: NetworkName) {
  switch (networkName) {
    case "mainnet":
      return 1;
    case "kovan":
      return 42;
    case "goerli":
      return 5;
    case "rinkeby":
      return 4;
  }
}

export default {
  chainId: getChainId,
  multichain,
  getConfig,
  getProvider,
  loadAccount,
  getDeployer,
  predictAddresses,
};
