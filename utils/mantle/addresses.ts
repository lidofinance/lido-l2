import { NetworkName } from "../network";
import { MntContractAddresses, CommonOptions } from "./types";

const MantleMainnetAddresses: MntContractAddresses = {
  L1CrossDomainMessenger: "0x676A795fe6E43C17c668de16730c3F690FEB7120",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x291dc3819b863e19b0a9b9809F8025d2EB4aaE93",
};

const MantleGoerliAddresses: MntContractAddresses = {
  L1CrossDomainMessenger: "0x7Bfe603647d5380ED3909F6f87580D0Af1B228B4",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x258e80D5371fD7fFdDFE29E60b366f9FC44844c8",
};

export default function addresses(
  networkName: NetworkName,
  options: CommonOptions = {}
) {
  switch (networkName) {
    case "mainnet":
      return { ...MantleMainnetAddresses, ...options.customAddresses };
    case "goerli":
      return { ...MantleGoerliAddresses, ...options.customAddresses };
    default:
      throw new Error(`Network "${networkName}" is not supported`);
  }
}
