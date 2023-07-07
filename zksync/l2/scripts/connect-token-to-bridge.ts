import { Wallet, Provider, Contract, utils } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import * as hre from "hardhat";

import { ADDRESSES, PRIVATE_KEY, ZKSYNC_PROVIDER_URL } from "./utils/constants";

const ERC20_BRIDGED_TOKEN_CONTRACT_NAME = "ERC20BridgedUpgradeable";

function getToken(hre: HardhatRuntimeEnvironment, wallet: Wallet): Contract {
  const artifact = hre.artifacts.readArtifactSync(
    ERC20_BRIDGED_TOKEN_CONTRACT_NAME
  );
  return new Contract(ADDRESSES.L2_LIDO_TOKEN_ADDR, artifact.abi, wallet);
}

async function main() {
  const provider = new Provider(ZKSYNC_PROVIDER_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const tokenContract = getToken(hre, wallet);

  const connectedBridgeAddress = await tokenContract.bridge();
  if (connectedBridgeAddress !== hre.ethers.constants.AddressZero) {
    throw new Error("Token is already connected to the bridge");
  }

  const gasPrice = await provider.getGasPrice();

  await (
    await tokenContract.__ERC20BridgedUpgradeable_init_v2(
      ADDRESSES.L2_LIDO_BRIDGE_PROXY_ADDR,
      {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: 0,
        gasLimit: 10_000_000,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        },
      }
    )
  ).wait();

  console.log(
    `Connected bridge address that can mint/burn tokens: ${await tokenContract.bridge()}`
  );
}

main().catch((error) => {
  throw error;
});
