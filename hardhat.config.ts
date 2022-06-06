import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "./tasks/fork-node";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.14",
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
      url: process.env.KOVAN_URL || "",
    },
    kovan_optimism: {
      url: process.env.KOVAN_OPTIMISM_URL || "",
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
    },
    rinkeby_arbitrum: {
      url: process.env.RINKEBY_ARBITRUM_URL || "",
    },
    mainnet: {
      url: process.env.MAINNET_URL || "",
    },
    mainnet_fork: {
      url: process.env.MAINNET_URL || "",
      forking: {
        url: process.env.MAINNET_URL || "",
      },
    },
    mainnet_arbitrum: {
      url: process.env.MAINNET_ARBITRUM_URL || "",
    },
    mainnet_optimism: {
      url: process.env.MAINNET_OPTIMISM_URL || "",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.RINKEBY_ETHERSCAN_API_KEY,
      arbitrumTestnet: process.env.RINKEBY_ARBITRUM_ETHERSCAN_API_KEY,
    },
  },
};

export default config;
