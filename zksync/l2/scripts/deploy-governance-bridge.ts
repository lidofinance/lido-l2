import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, utils } from "zksync-web3";
import * as hre from "hardhat";

import {
  GOVERNANCE_CONSTANTS,
  ADDRESSES,
  PRIVATE_KEY,
} from "./utils/constants";

const BRIDGE_EXECUTOR_CONTRACT_NAME = "ZkSyncBridgeExecutor";

async function main() {
  console.info("Deploying " + BRIDGE_EXECUTOR_CONTRACT_NAME + "...");

  const zkWallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);

  const artifact = await deployer.loadArtifact(BRIDGE_EXECUTOR_CONTRACT_NAME);

  const l2AddressOfL1Executor = utils.applyL1ToL2Alias(
    ADDRESSES.L1_EXECUTOR_ADDR
  );

  const contract = await deployer.deploy(artifact, [
    l2AddressOfL1Executor,
    GOVERNANCE_CONSTANTS.DELAY,
    GOVERNANCE_CONSTANTS.GRACE_PERIOD,
    GOVERNANCE_CONSTANTS.MIN_DELAY,
    GOVERNANCE_CONSTANTS.MAX_DELAY,
    ADDRESSES.GUARDIAN || hre.ethers.constants.AddressZero,
  ]);

  await contract.deployed();

  console.log(`L2_BRIDGE_EXECUTOR_ADDR=${contract.address}`);
}

main().catch((error) => {
  throw error;
});
