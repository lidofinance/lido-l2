import hre from "hardhat";
import { ERC20Stub__factory } from "../typechain";
import { DeployScript } from "../utils/deployment/DeployScript";
import { getDeployer } from "../utils/deployment/network";
import { promptProceed } from "../utils/prompt";

async function main() {
  const deployer = getDeployer(hre.network.name, hre);

  const deployScript = new DeployScript(deployer).addStep({
    factory: ERC20Stub__factory,
    args: ["Stub ERC20 Token", "StubERC20"],
  });

  console.log("Deploy ERC20 Stub Token:");
  deployScript.print();

  await promptProceed();

  await deployScript.run();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
