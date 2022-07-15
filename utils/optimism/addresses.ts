import { NetworkName } from "../network";

export type OptimismContractNames =
  | "L1CrossDomainMessenger"
  | "L2CrossDomainMessenger"
  | "CanonicalTransactionChain";

export type OptimismContractAddresses = Record<OptimismContractNames, string>;

const OptimismMainnetAddresses: OptimismContractAddresses = {
  L1CrossDomainMessenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0x5E4e65926BA27467555EB562121fac00D24E9dD2",
};

const OptimismKovanAddresses: OptimismContractAddresses = {
  L1CrossDomainMessenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  CanonicalTransactionChain: "0xe28c499EB8c36C0C18d1bdCdC47a51585698cb93",
};

export default function addresses(
  networkName: NetworkName,
  customAddresses: Partial<OptimismContractAddresses> = {}
) {
  switch (networkName) {
    case "mainnet":
    case "local_mainnet":
      return mergeAddresses(OptimismMainnetAddresses, customAddresses);
    case "testnet":
    case "local_testnet":
      return mergeAddresses(OptimismKovanAddresses, customAddresses);
    default:
      throw new Error(`Network ${networkName} not defined`);
  }
}

function mergeAddresses(
  addresses: OptimismContractAddresses,
  customAddresses: Partial<OptimismContractAddresses>
) {
  const res = { ...addresses };
  const contractNames = Object.keys(addresses) as OptimismContractNames[];
  for (const contractName of contractNames) {
    const address = customAddresses[contractName];
    if (address !== undefined) {
      res[contractName] = address;
    }
  }
  return res;
}
