import { providers } from "ethers";
import addresses from "./addresses";
import testing from "../testing";

export default {
  l1: {
    async L1GatewayRouterAdmin(provider: providers.JsonRpcProvider) {
      const network = await provider.getNetwork();
      return testing.impersonate(
        addresses.getL1(network.chainId).l1GatewayRouterOwner,
        provider
      );
    },
  },
};
