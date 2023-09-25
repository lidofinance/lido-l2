import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomicfoundation/hardhat-verify";

dotenv.config({ path: `../.env` });

const IS_LOCAL = (process.env.CHAIN_ETH_NETWORK as string) === "localhost";
const L1_DEFAULT_NETWORK = (process.env.L1_DEFAULT_NETWORK ||
  "goerli") as string;

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
  networks: {
    goerli: {
      url: process.env.ETH_CLIENT_WEB3_URL as string,
    },
  },
  ...(!IS_LOCAL && { defaultNetwork: L1_DEFAULT_NETWORK }),
  etherscan: {
    apiKey: process.env.ETHER_SCAN_API_KEY as string,
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
