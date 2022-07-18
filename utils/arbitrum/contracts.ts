import { ArbSys__factory } from "arb-ts";

import {
  L1GatewayRouter__factory,
  L2GatewayRouter__factory,
  ArbSysStub__factory,
} from "../../typechain/";
import addresses from "./addresses";
import network, { NetworkName } from "../network";
import { CustomArbContractAddresses } from "./types";

export default function contracts(
  networkName: NetworkName,
  customAddresses?: CustomArbContractAddresses
) {
  const [l1Provider, l2Provider] = network.getMultiChainProvider(
    "arbitrum",
    networkName
  );
  const arbAddresses = addresses(networkName, customAddresses);

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
  };
}
