import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-web3";
import * as hre from "hardhat";

import { PRIVATE_KEY } from "./utils/constants";
import { verify } from "./utils/verify";

const ERC20_BRIDGED_TOKEN_CONTRACT_NAME = "ERC20BridgedUpgradeable";

export async function main() {
  console.info("Deploying " + ERC20_BRIDGED_TOKEN_CONTRACT_NAME + "...");

  const zkWallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);

  const artifact = await deployer.loadArtifact(
    ERC20_BRIDGED_TOKEN_CONTRACT_NAME
  );

  const deployedContract = await deployer.deploy(artifact);
  const contractImpl = await deployedContract.deployed();

  console.log("New wstETH implementation deployed at:", contractImpl.address);
  await verify(contractImpl.address);

  return contractImpl.address;
}

main().catch((error) => {
  throw error;
});
