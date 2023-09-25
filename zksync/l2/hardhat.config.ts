import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-verify";
import "@matterlabs/hardhat-zksync-upgradable";
import "@matterlabs/hardhat-zksync-chai-matchers";

dotenv.config({ path: "../.env" });

const L1_RPC_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const L2_RPC_URL = process.env.ZKSYNC_PROVIDER_URL as string;

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {
      isSystem: true,
    },
  },
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100_000,
      },
    },
  },
  defaultNetwork: "zkSyncNetwork",
  networks: {
    goerli: {
      zksync: false,
      url: L1_RPC_URL,
    },
    zkSyncNetwork: {
      zksync: true,
      ethNetwork: "goerli",
      url: L2_RPC_URL,
      verifyURL: process.env.ZKSYNC_VERIFY_URL as string,
    },
  },
  paths: {
    root: "../",
    sources: "l2/contracts",
    cache: "l2/cache-zk",
    artifacts: "l2/artifacts-zk",
  },
};

export default config;
