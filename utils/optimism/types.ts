export type OptContractNames =
  | "L1CrossDomainMessenger"
  | "L2CrossDomainMessenger";

export type OptContractAddresses = Record<OptContractNames, string>;
export type CustomOptContractAddresses = Partial<OptContractAddresses>;
export interface CommonOptions {
  customAddresses?: CustomOptContractAddresses;
}
