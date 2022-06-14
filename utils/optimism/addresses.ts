export interface OptimismL2Addresses {
  messenger: string;
}

export interface OptimismL1Addresses extends OptimismL2Addresses {
  canonicalTransactionChain: string;
}

interface OptimismAddresses {
  l1: Record<number, OptimismL1Addresses>;
  l2: Record<number, OptimismL2Addresses>;
}

const ADDRESSES: OptimismAddresses = {
  l1: {
    1: {
      messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
      canonicalTransactionChain: "0x5E4e65926BA27467555EB562121fac00D24E9dD2",
    },
    42: {
      messenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD",
      canonicalTransactionChain: "0xe28c499EB8c36C0C18d1bdCdC47a51585698cb93",
    },
    31337: {
      messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
      canonicalTransactionChain: "0x5E4e65926BA27467555EB562121fac00D24E9dD2",
    },
  },
  l2: {
    1: {
      messenger: "0x4200000000000000000000000000000000000007",
    },
    69: {
      messenger: "0x4200000000000000000000000000000000000007",
    },
    31337: {
      messenger: "0x4200000000000000000000000000000000000007",
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
