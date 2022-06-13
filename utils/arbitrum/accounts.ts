import { providers } from "ethers";
import { impersonate } from "../account";
import addresses from "./addresses";

export default {
  l1: {
    async L1GatewayRouterAdmin(provider: providers.JsonRpcProvider) {
      const network = await provider.getNetwork();
      return impersonate(
        addresses.getL1(network.chainId).l1GatewayRouterOwner,
        provider
      );
    },
  },
};
