import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, utils } from "zksync-web3";
import * as hre from "hardhat";

import {
  GOVERNANCE_CONSTANTS,
  ADDRESSES,
  DEPLOYER_WALLET_PRIVATE_KEY,
} from "./utils/constants";

const BRIDGE_EXECUTOR_CONTRACT_NAME = "ZkSyncBridgeExecutorUpgradable";

async function main() {
  console.info("Deploying " + BRIDGE_EXECUTOR_CONTRACT_NAME + "...");

  const zkWallet = new Wallet(DEPLOYER_WALLET_PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);

  const artifact = await deployer.loadArtifact(BRIDGE_EXECUTOR_CONTRACT_NAME);

  const contract = await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    artifact,
    [
      ADDRESSES.L1_EXECUTOR_ADDR,
      GOVERNANCE_CONSTANTS.DELAY,
      GOVERNANCE_CONSTANTS.GRACE_PERIOD,
      GOVERNANCE_CONSTANTS.MIN_DELAY,
      GOVERNANCE_CONSTANTS.MAX_DELAY,
      ADDRESSES.GUARDIAN || hre.ethers.constants.AddressZero,
    ],
    { initializer: "__ZkSyncBridgeExecutor_init" }
  );

  await contract.deployed();

  console.log(`L2_BRIDGE_EXECUTOR_ADDR=${contract.address}`);

  const newOwner = utils.applyL1ToL2Alias(ADDRESSES.L1_EXECUTOR_ADDR);

  await hre.zkUpgrades.admin.transferProxyAdminOwnership(
    newOwner,
    deployer.zkWallet
  );

  console.log(`New proxy admin owner: ${newOwner}`);
}

main().catch((error) => {
  throw error;
});
