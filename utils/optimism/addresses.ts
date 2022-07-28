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

// DEPRECATED
const OptimismKovanAddresses: OptContractAddresses = {
  L1CrossDomainMessenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0xe28c499EB8c36C0C18d1bdCdC47a51585698cb93",
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
    case "kovan":
      return { ...OptimismKovanAddresses, ...options.customAddresses };
    default:
      throw new Error(`Network "${networkName}" is not supported`);
  }
}
