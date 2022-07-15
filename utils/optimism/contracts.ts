import {
  CanonicalTransactionChain__factory,
  CrossDomainMessengerStub__factory,
  L1CrossDomainMessenger__factory,
  L2CrossDomainMessenger__factory,
} from "../../typechain";
import network, { NetworkName } from "../network";
import addresses, { OptimismContractAddresses } from "./addresses";

export default function contracts(
  networkName: NetworkName,
  customAddresses?: Partial<OptimismContractAddresses>
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

// export default {
//   get(
//     addresses: OptimismContractAddresses,
//     l1SignerOrProvider: SignerOrProvider,
//     l2SignerOrProvider: SignerOrProvider
//   ) {
//     return {
//       L1CrossDomainMessenger: L1CrossDomainMessenger__factory.connect(
//         addresses.L1CrossDomainMessenger,
//         l1SignerOrProvider
//       ),
//       L2CrossDomainMessenger: L2CrossDomainMessenger__factory.connect(
//         addresses.L1CrossDomainMessenger,
//         l2SignerOrProvider
//       ),
//       CanonicalTransactionChain: CanonicalTransactionChain__factory.connect(
//         addresses.CanonicalTransactionChain,
//         l1SignerOrProvider
//       ),
//     };
//   },
// };
