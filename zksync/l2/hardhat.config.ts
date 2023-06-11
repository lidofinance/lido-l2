import { HardhatUserConfig } from "hardhat/config";
import '@matterlabs/hardhat-zksync-solc';

const config: HardhatUserConfig = {
  zksolc: {
    version: '1.3.10',
    compilerSource: 'binary',
    settings: {
      isSystem: true,
    },
  },
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100_000,
      },
    },
  },
  networks: {
    hardhat: {
      zksync: true
    }
  },
  paths: {
    root: "../../",
    sources: "zksync/l2/contracts",
    cache: "zksync/l2/cache-zk",
    artifacts: "zksync/l2/artifacts-zk"
  }
};

export default config;