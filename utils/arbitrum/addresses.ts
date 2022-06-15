export interface ArbitrumL1Addresses {
  inbox: string;
  l1GatewayRouter: string;
  l1GatewayRouterOwner: string;
  bridge: string;
  outbox: string;
}

export interface ArbitrumL2Addresses {
  arbSys: string;
  router: string;
  l2GatewayRouter: string;
}

export interface ArbitrumAddresses {
  l1: Record<number, ArbitrumL1Addresses>;
  l2: Record<number, ArbitrumL2Addresses>;
}

const ADDRESSES: ArbitrumAddresses = {
  l1: {
    1: {
      inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
      l1GatewayRouter: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
      l1GatewayRouterOwner: "0xc234e41ae2cb00311956aa7109fc801ae8c80941",
      bridge: "0x2f06e43D850Ac75926FA2866e40139475b58Cb16",
      outbox: "0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40",
    },
    4: {
      inbox: "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e",
      l1GatewayRouter: "0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380",
      l1GatewayRouterOwner: "0xdf8107d1758d1d7dcfb29511557bc92daa119174",
      bridge: "0x9a28E783c47bBEB813F32B861A431d0776681E95",
      outbox: "0x2360A33905dc1c72b12d975d975F42BaBdcef9F3",
    },
    31337: {
      inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
      l1GatewayRouter: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
      l1GatewayRouterOwner: "0xc234e41ae2cb00311956aa7109fc801ae8c80941",
      bridge: "0x2f06e43D850Ac75926FA2866e40139475b58Cb16",
      outbox: "0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40",
    },
  },
  l2: {
    42161: {
      arbSys: "0x0000000000000000000000000000000000000064",
      router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
      l2GatewayRouter: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
    },
    421611: {
      arbSys: "0x0000000000000000000000000000000000000064",
      router: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
      l2GatewayRouter: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
    },
    31337: {
      arbSys: "0x0000000000000000000000000000000000000064",
      router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
      l2GatewayRouter: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
    },
  },
};

export default {
  getL1(chainId: number) {
    const addresses = ADDRESSES.l1[chainId];
    if (!addresses) {
      throw new Error(`L1 addresses for chain id ${chainId} not found`);
    }
    return addresses;
  },
  getL2(chainId: number) {
    const addresses = ADDRESSES.l2[chainId];
    if (!addresses) {
      throw new Error(`L2 addresses for chain id ${chainId} not found`);
    }
    return addresses;
  },
};
