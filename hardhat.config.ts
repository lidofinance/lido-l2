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
    local: {
      url: "http://localhost:8545",
    },
    local_arbitrum: {
      url: "http://localhost:8546",
    },
    local_optimism: {
      url: "http://localhost:9545",
    },
    kovan: {
      url: env.string("RPC_ETH_KOVAN", ""),
    },
    kovan_optimism: {
      url: env.string("RPC_OPT_KOVAN", ""),
    },
    rinkeby: {
      url: env.string("RPC_ETH_RINKEBY", ""),
    },
    rinkeby_arbitrum: {
      url: env.string("RPC_ARB_RINKEBY", ""),
    },
    mainnet: {
      url: env.string("RPC_ETH_MAINNET", ""),
    },
    mainnet_arbitrum: {
      url: env.string("RPC_ARB_MAINNET", ""),
    },
    mainnet_optimism: {
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
