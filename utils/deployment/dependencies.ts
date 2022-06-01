import { BaseProvider } from "@ethersproject/providers";

interface L1ArbitrumDependencies {
  inbox: string;
  router: string;
}

interface L2ArbitrumDependencies {
  arbSys: string;
  router: string;
}

export interface ArbitrumDeploymentDependencies {
  l1: { inbox: string; router: string };
  l2: { arbSys: string; router: string };
}

interface OptimismCommonDependencies {
  messenger: string;
}

export interface OptimismDeploymentDependencies {
  l1: OptimismCommonDependencies;
  l2: OptimismCommonDependencies;
}

const L1_DEPENDENCIES: Record<number, L1ArbitrumDependencies> = {
  1: {
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    router: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  },
  4: {
    inbox: "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e",
    router: "0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380",
  },
  31337: {
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    router: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  },
};

const L2_DEPENDENCIES: Record<number, L2ArbitrumDependencies> = {
  1: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
  },
  4: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
  },
  31337: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
  },
};

interface DeploymentNetwork {
  l1: { provider: BaseProvider };
  l2: { provider: BaseProvider };
}

export async function loadArbitrumDeployDependencies(
  deploymentNetwork: DeploymentNetwork,
  manualDependencies?: ArbitrumDependencies
) {
  if (manualDependencies) {
    return manualDependencies;
  }
  const [{ chainId: l1ChainId }, { chainId: l2ChainId }] = await Promise.all([
    deploymentNetwork.l1.provider.getNetwork(),
    deploymentNetwork.l2.provider.getNetwork(),
  ]);

  const l1 = L1_DEPENDENCIES[l1ChainId];
  const l2 = L2_DEPENDENCIES[l2ChainId];
  if (!l1 || !l2) {
    throw new Error(
      `Dependencies for chain ids ${l1ChainId} and ${l2ChainId} not found`
    );
  }

  return { l1, l2 };
}

const OPT_L1_DEPENDENCIES: Record<number, OptimismCommonDependencies> = {
  1: { messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1" },
  17: { messenger: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
  42: { messenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD" },
  31337: { messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1" },
};

const OPT_L2_DEPENDENCIES: Record<number, OptimismCommonDependencies> = {
  1: { messenger: "0x4200000000000000000000000000000000000007" },
  42: { messenger: "0x4200000000000000000000000000000000000007" },
  31337: { messenger: "0x4200000000000000000000000000000000000007" },
};

export async function loadOptimismDeployDependencies(
  deploymentNetwork: DeploymentNetwork,
  manualDependencies?: OptimismDeploymentDependencies
) {
  if (manualDependencies) {
    return manualDependencies;
  }
  const [{ chainId: l1ChainId }, { chainId: l2ChainId }] = await Promise.all([
    deploymentNetwork.l1.provider.getNetwork(),
    deploymentNetwork.l2.provider.getNetwork(),
  ]);

  const l1 = OPT_L1_DEPENDENCIES[l1ChainId];
  const l2 = OPT_L2_DEPENDENCIES[l2ChainId];
  if (!l1 || !l2) {
    throw new Error(
      `Dependencies for chain ids ${l1ChainId} and ${l2ChainId} not found`
    );
  }

  return { l1, l2 };
}
