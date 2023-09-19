import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomicfoundation/hardhat-verify";

dotenv.config({ path: "../.env" });

const ETH_NETWORK_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const ETHER_SCAN_API_KEY = process.env.ETHER_SCAN_API_KEY as string;

const config: HardhatUserConfig & { etherscan: { apiKey: string } } = {
  solidity: {
    version: "0.8.15",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100_000,
      },
    },
  },
  defaultNetwork: "goerli",
  networks: {
    goerli: {
      url: ETH_NETWORK_URL,
    },
  },
  etherscan: {
    apiKey: ETHER_SCAN_API_KEY,
  },
  paths: {
    root: "../",
    sources: "l1/contracts",
    cache: "l1/cache",
    artifacts: "l1/artifacts",
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
