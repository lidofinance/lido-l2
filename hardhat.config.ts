import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "./tasks/fork-node";
import { getEnvVariable } from "./utils/env";

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
      url: getEnvVariable("KOVAN_URL", ""),
    },
    kovan_optimism: {
      url: getEnvVariable("KOVAN_OPTIMISM_URL", ""),
    },
    rinkeby: {
      url: getEnvVariable("RINKEBY_URL", ""),
    },
    rinkeby_arbitrum: {
      url: getEnvVariable("RINKEBY_ARBITRUM_URL", ""),
    },
    mainnet: {
      url: getEnvVariable("MAINNET_URL", ""),
    },
    mainnet_fork: {
      url: getEnvVariable("MAINNET_URL", ""),
      forking: {
        url: getEnvVariable("MAINNET_URL", ""),
      },
    },
    mainnet_arbitrum: {
      url: getEnvVariable("MAINNET_ARBITRUM_URL", ""),
    },
    mainnet_optimism: {
      url: getEnvVariable("MAINNET_OPTIMISM_URL", ""),
    },
  },
  gasReporter: {
    enabled: getEnvVariable("REPORT_GAS", "false") !== "false",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      rinkeby: getEnvVariable("RINKEBY_ETHERSCAN_API_KEY", ""),
      kovan: getEnvVariable("KOVAN_ETHERSCAN_API_KEY", ""),
      arbitrumTestnet: getEnvVariable("RINKEBY_ARBITRUM_ETHERSCAN_API_KEY", ""),
      optimisticKovan: getEnvVariable("KOVAN_OPTIMISM_ETHERSCAN_API_KEY", ""),
    },
  },
  typechain: {
    externalArtifacts: ["./interfaces/**/*.json"],
  },
};

export default config;
