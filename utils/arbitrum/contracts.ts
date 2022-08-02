import { ArbSys__factory } from "arb-ts";

import {
  L1GatewayRouter__factory,
  L2GatewayRouter__factory,
  ArbSysStub__factory,
  Inbox__factory,
} from "../../typechain/";
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
    .multichain(["eth", "arb"], networkName)
    .getProviders(options);

  const arbAddresses = addresses(networkName, options);

  return {
    ArbSys: ArbSys__factory.connect(arbAddresses.ArbSys, l2Provider),
    ArbSysStub: ArbSysStub__factory.connect(arbAddresses.ArbSys, l2Provider),
    L1GatewayRouter: L1GatewayRouter__factory.connect(
      arbAddresses.L1GatewayRouter,
      l1Provider
    ),
    L2GatewayRouter: L2GatewayRouter__factory.connect(
      arbAddresses.L2GatewayRouter,
      l2Provider
    ),
    Inbox: Inbox__factory.connect(arbAddresses.Inbox, l1Provider),
  };
}
