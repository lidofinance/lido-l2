import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "./tasks/fork-node";
import env from "./utils/env";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.6.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100_000,
          },
        },
      },
    ],
  },
  networks: {
    // local Ethereum networks
    local_eth_mainnet: {
      url: "http://localhost:8545",
    },
    local_eth_kovan: {
      url: "http://localhost:8545",
    },
    local_eth_rinkeby: {
      url: "http://localhost:8545",
    },

    // local Arbitrum networks
    local_arb_mainnet: {
      url: "http://localhost:8546",
    },
    local_arb_rinkeby: {
      url: "http://localhost:8546",
    },

    // local Optimism networks
    local_opt_mainnet: {
      url: "http://localhost:9545",
    },
    local_opt_kovan: {
      url: "http://localhost:9545",
    },

    // public Ethereum networks
    eth_kovan: {
      url: env.string("RPC_ETH_KOVAN", ""),
    },
    eth_rinkeby: {
      url: env.string("RPC_ETH_RINKEBY", ""),
    },
    eth_mainnet: {
      url: env.string("RPC_ETH_MAINNET", ""),
    },

    // public Arbitrum networks
    arb_rinkeby: {
      url: env.string("RPC_ARB_RINKEBY", ""),
    },
    arb_mainnet: {
      url: env.string("RPC_ARB_MAINNET", ""),
    },

    // public Optimism networks
    opt_kovan: {
      url: env.string("RPC_OPT_KOVAN", ""),
    },
    opt_mainnet: {
      url: env.string("RPC_OPT_MAINNET", ""),
    },
  },
  gasReporter: {
    enabled: env.string("REPORT_GAS", "false") !== "false",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      kovan: env.string("ETHERSCAN_API_KEY_ETH", ""),
      rinkeby: env.string("ETHERSCAN_API_KEY_ETH", ""),
      mainnet: env.string("ETHERSCAN_API_KEY_ETH", ""),
      arbitrumTestnet: env.string("ETHERSCAN_API_KEY_ARB", ""),
      arbitrumOne: env.string("ETHERSCAN_API_KEY_ARB", ""),
      optimisticKovan: env.string("ETHERSCAN_API_KEY_OPT", ""),
      optimisticEthereum: env.string("ETHERSCAN_API_KEY_OPT", ""),
    },
  },
  typechain: {
    externalArtifacts: [
      "./interfaces/**/*.json",
      "./utils/optimism/artifacts/*.json",
      "./utils/arbitrum/artifacts/*.json",
    ],
  },
  mocha: {
    timeout: 20 * 60 * 60 * 1000, // 20 minutes for e2e tests
  },
};

export default config;
