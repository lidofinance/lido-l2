export type MntContractNames =
  | "L1CrossDomainMessenger"
  | "L2CrossDomainMessenger"
  | "CanonicalTransactionChain";

export type MntContractAddresses = Record<MntContractNames, string>;
export type CustomMntContractAddresses = Partial<MntContractAddresses>;
export interface CommonOptions {
  customAddresses?: CustomMntContractAddresses;
}
