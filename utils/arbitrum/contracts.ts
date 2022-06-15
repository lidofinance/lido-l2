import { Signer } from "ethers";
import addresses from "./addresses";
import {
  Bridge__factory,
  L1GatewayRouter__factory,
  L2GatewayRouter__factory,
} from "../../typechain/";

export default {
  l1: {
    async L1GatewayRouter(signer: Signer) {
      const chainId = await signer.getChainId();
      return L1GatewayRouter__factory.connect(
        addresses.getL1(chainId).l1GatewayRouter,
        signer
      );
    },
    async Bridge(signer: Signer) {
      const chainId = await signer.getChainId();
      return Bridge__factory.connect(addresses.getL1(chainId).bridge, signer);
    },
  },
  l2: {
    async L2GatewayRouter(signer: Signer) {
      const chainId = await signer.getChainId();
      return L2GatewayRouter__factory.connect(
        addresses.getL2(chainId).l2GatewayRouter,
        signer
      );
    },
  },
};
