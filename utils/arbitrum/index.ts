import network, { NetworkName } from "../network";
import addresses, {
  ArbitrumContractAddresses,
  ArbitrumContractNames,
} from "./addresses";
import testing from "./testing";
import contracts from "./contracts";
import deployment from "./deployment";

function getAddresses(
  networkName: NetworkName,
  customAddresses: Partial<ArbitrumContractAddresses> = {}
) {
  const custonContractNames = Object.keys(
    customAddresses
  ) as ArbitrumContractNames[];
  for (const contractName of custonContractNames) {
    if (!customAddresses[contractName]) {
      delete customAddresses[contractName];
    }
  }
  return { ...addresses.get(networkName), ...customAddresses };
}

export default {
  testing,
  addresses: getAddresses,
  deployment: {
    erc20TokenGateways(
      networkName: NetworkName,
      customAddresses?: Partial<ArbitrumContractAddresses>
    ) {
      return deployment.erc20TokenGateways(
        getAddresses(networkName, customAddresses)
      );
    },
    gatewayRouters(
      networkName: NetworkName,
      customAddresses?: Partial<ArbitrumContractAddresses>
    ) {
      return deployment.gatewayRouters(
        getAddresses(networkName, customAddresses)
      );
    },
  },
  contracts(
    networkName: NetworkName,
    customAddresses?: Partial<ArbitrumContractAddresses>
  ) {
    const [l1Provider, l2Provider] = network.getMultiChainProvider(
      "arbitrum",
      networkName
    );
    return contracts.get(
      getAddresses(networkName, customAddresses),
      l1Provider,
      l2Provider
    );
  },
};
