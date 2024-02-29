import {
  CrossDomainMessengerStub__factory,
  L1CrossDomainMessenger__factory,
  L2CrossDomainMessenger__factory,
} from "../../typechain";
import addresses from "./addresses";
import { CommonOptions } from "./types";
import network, { NetworkName } from "../network";

interface ContractsOptions extends CommonOptions {
  forking: boolean;
}

export default function contracts(
  networkName: NetworkName,
  options: ContractsOptions
) {
  const [l1Provider, l2Provider] = network
    .multichain(["eth", "opt"], networkName)
    .getProviders(options);

  const optAddresses = addresses(networkName, options);

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
  };
}
