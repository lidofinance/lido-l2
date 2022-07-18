import {
  CanonicalTransactionChain__factory,
  CrossDomainMessengerStub__factory,
  L1CrossDomainMessenger__factory,
  L2CrossDomainMessenger__factory,
} from "../../typechain";
import addresses from "./addresses";
import network, { NetworkName } from "../network";
import { OptContractAddresses } from "./types";

export default function contracts(
  networkName: NetworkName,
  customAddresses?: Partial<OptContractAddresses>
) {
  const [l1Provider, l2Provider] = network.getMultiChainProvider(
    "optimism",
    networkName
  );
  const optAddresses = addresses(networkName, customAddresses);
  return {
    L1CrossDomainMessenger: L1CrossDomainMessenger__factory.connect(
      optAddresses.L1CrossDomainMessenger,
      l1Provider
    ),
    L1CrossDomainMessengerStub: CrossDomainMessengerStub__factory.connect(
      optAddresses.L1CrossDomainMessenger,
      l1Provider
    ),
    L2CrossDomainMessenger: L2CrossDomainMessenger__factory.connect(
      optAddresses.L2CrossDomainMessenger,
      l2Provider
    ),
    CanonicalTransactionChain: CanonicalTransactionChain__factory.connect(
      optAddresses.CanonicalTransactionChain,
      l1Provider
    ),
  };
}
