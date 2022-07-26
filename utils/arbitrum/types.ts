export type ArbContractNames =
  | "Inbox"
  | "ArbSys"
  | "Bridge"
  | "Outbox"
  | "L1GatewayRouter"
  | "L2GatewayRouter";

export type ArbContractAddresses = Record<ArbContractNames, string>;

export type CustomArbContractAddresses = Partial<ArbContractAddresses>;

export interface CommonOptions {
  customAddresses?: CustomArbContractAddresses;
}
