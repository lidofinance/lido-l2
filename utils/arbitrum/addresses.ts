import { NetworkName } from "../network";
import { ArbContractAddresses, CommonOptions } from "./types";

const ArbitrumMainnetAddresses: ArbContractAddresses = {
  Inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
  ArbSys: "0x0000000000000000000000000000000000000064",
  Bridge: "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a",
  Outbox: "0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40",
  L1GatewayRouter: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  L2GatewayRouter: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
};

const ArbitrumGoerliAddresses: ArbContractAddresses = {
  Inbox: "0x6BEbC4925716945D46F0Ec336D5C2564F419682C",
  ArbSys: "0x0000000000000000000000000000000000000064",
  Bridge: "0xaf4159A80B6Cc41ED517DB1c453d1Ef5C2e4dB72",
  Outbox: "0x45Af9Ed1D03703e480CE7d328fB684bb67DA5049",
  L1GatewayRouter: "0x4c7708168395aEa569453Fc36862D2ffcDaC588c",
  L2GatewayRouter: "0xE5B9d8d42d656d1DcB8065A6c012FE3780246041",
};

export default function addresses(
  networkName: NetworkName,
  options: CommonOptions = {}
) {
  switch (networkName) {
    case "mainnet":
      return { ...ArbitrumMainnetAddresses, ...options.customAddresses };
    case "sepolia":
      return { ...ArbitrumGoerliAddresses, ...options.customAddresses };
    default:
      throw new Error(`Network "${networkName}" is not supported`);
  }
}
