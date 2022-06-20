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
    version: "0.8.14",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000,
      },
    },
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
      url: env.string("KOVAN_URL", ""),
    },
    kovan_optimism: {
      url: env.string("KOVAN_OPTIMISM_URL", ""),
    },
    rinkeby: {
      url: env.string("RINKEBY_URL", ""),
    },
    rinkeby_arbitrum: {
      url: env.string("RINKEBY_ARBITRUM_URL", ""),
    },
    mainnet: {
      url: env.string("MAINNET_URL", ""),
    },
    mainnet_fork: {
      url: env.string("MAINNET_URL", ""),
      forking: {
        url: env.string("MAINNET_URL", ""),
      },
    },
    mainnet_arbitrum: {
      url: env.string("MAINNET_ARBITRUM_URL", ""),
    },
    mainnet_optimism: {
      url: env.string("MAINNET_OPTIMISM_URL", ""),
    },
  },
  gasReporter: {
    enabled: env.string("REPORT_GAS", "false") !== "false",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      rinkeby: env.string("RINKEBY_ETHERSCAN_API_KEY", ""),
      kovan: env.string("KOVAN_ETHERSCAN_API_KEY", ""),
      arbitrumTestnet: env.string("RINKEBY_ARBITRUM_ETHERSCAN_API_KEY", ""),
      optimisticKovan: env.string("KOVAN_OPTIMISM_ETHERSCAN_API_KEY", ""),
    },
  },
  typechain: {
    externalArtifacts: ["./interfaces/**/*.json"],
  },
  mocha: {
    timeout: 20 * 60 * 60 * 1000, // 20 minutes for e2e tests
  },
};

export default config;
