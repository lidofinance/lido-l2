import { NetworkName } from "../network";
import { OptContractAddresses, CommonOptions } from "./types";

const OptimismMainnetAddresses: OptContractAddresses = {
  L1CrossDomainMessenger: "0x866E82a600A1414e583f7F13623F1aC5d58b0Afa",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x0000000000000000000000000000000000000000",
};

const OptimismGoerliAddresses: OptContractAddresses = {
  L1CrossDomainMessenger: "0x8e5693140eA606bcEB98761d9beB1BC87383706D",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x0000000000000000000000000000000000000000",
};

export default function addresses(
  networkName: NetworkName,
  options: CommonOptions = {}
) {
  switch (networkName) {
    case "mainnet":
      return { ...OptimismMainnetAddresses, ...options.customAddresses };
    case "goerli":
      return { ...OptimismGoerliAddresses, ...options.customAddresses };
    default:
      throw new Error(`Network "${networkName}" is not supported`);
  }
}
