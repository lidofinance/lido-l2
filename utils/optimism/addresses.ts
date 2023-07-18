import { NetworkName } from "../network";
import { OptContractAddresses, CommonOptions } from "./types";

const OptimismMainnetAddresses: OptContractAddresses = {
  L1CrossDomainMessenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x5E4e65926BA27467555EB562121fac00D24E9dD2",
};

const OptimismGoerliAddresses: OptContractAddresses = {
  L1CrossDomainMessenger: "0x5086d1eEF304eb5284A0f6720f79403b4e9bE294",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x607F755149cFEB3a14E1Dc3A4E2450Cde7dfb04D",
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
