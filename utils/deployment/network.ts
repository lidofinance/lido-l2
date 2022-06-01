import { providers, Wallet } from "ethers";
import { getEnvVariable } from "../env";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getContractAddress } from "ethers/lib/utils";

export interface DeploymentNetwork {
  l1: { provider: providers.JsonRpcProvider; deployer: Wallet };
  l2: { provider: providers.JsonRpcProvider; deployer: Wallet };
}

export function getDeploymentNetwork(hre: HardhatRuntimeEnvironment) {
  const l2NetworkName = hre.network.name;
  const [l1NetworkName, l2ProtocolName] = hre.network.name.split("_");

  if (!l1NetworkName || !l2ProtocolName) {
    throw new Error(
      "Invalid L2 network name. It must be in form {L1_NETWORK_NAME}_{L2_PROTOCOL_NAME}. For example: rinkeby_arbitrum, mainnet_optimism"
    );
  }
  const l2Network = hre.config.networks[l2NetworkName];
  const l1Network = hre.config.networks[l1NetworkName];

  if (!l1Network) {
    throw new Error(
      `Network with name ${l1NetworkName} not found. Check your hardhat.config.ts file declares network with given name`
    );
  }

  const PRIVATE_KEY = getEnvVariable("PRIVATE_KEY");

  // @ts-ignore
  const l1Provider = new providers.JsonRpcProvider(l1Network.url);
  // @ts-ignore
  const l2Provider = new providers.JsonRpcProvider(l2Network.url);
  return {
    name: l2NetworkName,
    l1: {
      provider: l1Provider,
      deployer: new Wallet(PRIVATE_KEY, l1Provider),
    },
    l2: {
      provider: l2Provider,
      deployer: new Wallet(PRIVATE_KEY, l2Provider),
    },
  };
}

// predicts future addresses of the contracts deployed by account
export async function predictAddresses(account: Wallet, txsCount: number) {
  const currentNonce = await account.getTransactionCount();

  const res: string[] = [];
  for (let i = 0; i < txsCount; ++i) {
    res.push(
      getContractAddress({
        from: account.address,
        nonce: currentNonce + i,
      })
    );
  }
  return res;
}
