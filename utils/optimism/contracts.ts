import { Signer } from "ethers";
import addresses from "./addresses";
import {
  CanonicalTransactionChain__factory,
  L1CrossDomainMessenger__factory,
  L2CrossDomainMessenger__factory,
} from "../../typechain";

export default {
  l1: {
    async L1CrossDomainMessenger(signer: Signer) {
      const chainId = await signer.getChainId();
      return L1CrossDomainMessenger__factory.connect(
        addresses.getL1(chainId).messenger,
        signer
      );
    },
    async CanonicalTransactionChain(signer: Signer) {
      const chainId = await signer.getChainId();
      return CanonicalTransactionChain__factory.connect(
        addresses.getL1(chainId).canonicalTransactionChain,
        signer
      );
    },
  },
  l2: {
    async L2CrossDomainMessenger(signer: Signer) {
      const chainId = await signer.getChainId();
      return L2CrossDomainMessenger__factory.connect(
        addresses.getL2(chainId).messenger,
        signer
      );
    },
  },
};
