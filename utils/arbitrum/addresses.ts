import { NetworkName } from "../network";

export type ArbitrumContractNames =
  | "Inbox"
  | "ArbSys"
  | "Bridge"
  | "Outbox"
  | "L1GatewayRouter"
  | "L2GatewayRouter"
  | "L1GatewayRouterOwner";

export type ArbitrumContractAddresses = Record<ArbitrumContractNames, string>;

const ArbitrumMainnetAddresses: ArbitrumContractAddresses = {
  Inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
  ArbSys: "0x0000000000000000000000000000000000000064",
  Bridge: "0x2f06e43D850Ac75926FA2866e40139475b58Cb16",
  Outbox: "0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40",
  L1GatewayRouter: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  L2GatewayRouter: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
  L1GatewayRouterOwner: "0xc234e41ae2cb00311956aa7109fc801ae8c80941",
};

const ArbitrumTestnetAddresses: ArbitrumContractAddresses = {
  Inbox: "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e",
  ArbSys: "0x0000000000000000000000000000000000000064",
  Bridge: "0x9a28E783c47bBEB813F32B861A431d0776681E95",
  Outbox: "0x2360A33905dc1c72b12d975d975F42BaBdcef9F3",
  L1GatewayRouter: "0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380",
  L2GatewayRouter: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
  L1GatewayRouterOwner: "0xdf8107d1758d1d7dcfb29511557bc92daa119174",
};

export default {
  get(networkName: NetworkName) {
    switch (networkName) {
      case "mainnet":
      case "local_mainnet":
        return ArbitrumMainnetAddresses;
      case "testnet":
      case "local_testnet":
        return ArbitrumTestnetAddresses;
    }
  },
};
