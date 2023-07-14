import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, utils } from "zksync-web3";
import * as hre from "hardhat";

import {
  ERC20_BRIDGED_CONSTANTS,
  PRIVATE_KEY,
  ADDRESSES,
} from "./utils/constants";

const ERC20_BRIDGED_TOKEN_CONTRACT_NAME = "ERC20BridgedUpgradeable";

async function main() {
  console.info("Deploying " + ERC20_BRIDGED_TOKEN_CONTRACT_NAME + "...");

  const zkWallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);

  const artifact = await deployer.loadArtifact(
    ERC20_BRIDGED_TOKEN_CONTRACT_NAME
  );

  const contract = await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    artifact,
    [
      ERC20_BRIDGED_CONSTANTS.NAME,
      ERC20_BRIDGED_CONSTANTS.SYMBOL,
      ERC20_BRIDGED_CONSTANTS.DECIMALS,
    ],
    { initializer: "__ERC20BridgedUpgradeable_init" }
  );

  await contract.deployed();

  console.log(`CONTRACTS_L2_LIDO_TOKEN_ADDR=${contract.address}`);

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
