export const ZKSYNC_ADDRESSES = {
  l1: {
    l1Token: process.env.CONTRACTS_L1_LIDO_TOKEN_ADDR || "",
    l1Bridge: process.env.CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR || "",
    l1Executor: process.env.CONTRACTS_L1_GOVERNANCE_EXECUTOR_ADDR,
    agent: process.env.CONTRACTS_L1_GOVERNANCE_AGENT_ADDR || "",
  },
  l2: {
    l2Token: process.env.CONTRACTS_L2_LIDO_TOKEN_ADDR || "",
    l2Bridge: process.env.CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR || "",
    govExecutor: process.env.L2_BRIDGE_EXECUTOR_ADDR || "",
  },
};
