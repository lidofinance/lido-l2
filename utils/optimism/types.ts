export type OptContractNames =
  | "L1CrossDomainMessenger"
  | "L2CrossDomainMessenger"
  | "CanonicalTransactionChain";

export type OptContractAddresses = Record<OptContractNames, string>;
export type CustomOptContractAddresses = Partial<OptContractAddresses>;
