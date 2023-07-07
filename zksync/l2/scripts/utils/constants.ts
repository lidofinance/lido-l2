export const ADDRESSES = {
  L1_EXECUTOR_ADDR: process.env.L1_EXECUTOR_ADDR as string,
  L2_BRIDGE_EXECUTOR_ADDR: process.env.L2_BRIDGE_EXECUTOR_ADDR as string,
  GUARDIAN: process.env.GUARDIAN_ADDRESS as string,
  L2_LIDO_BRIDGE_PROXY_ADDR: process.env
    .CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR as string,
  L2_LIDO_TOKEN_ADDR: process.env.CONTRACTS_L2_LIDO_TOKEN_ADDR as string,
};

export const DEPLOYER_WALLET_PRIVATE_KEY = process.env
  .DEPLOYER_WALLET_PRIVATE_KEY as string;

export const GOVERNANCE_CONSTANTS = {
  DELAY: process.env.EXECUTION_DELAY as string,
  GRACE_PERIOD: process.env.EXECUTION_GRACE_PERIOD as string,
  MIN_DELAY: process.env.EXECUTION_MIN_DELAY as string,
  MAX_DELAY: process.env.EXECUTION_MAX_DELAY as string,
};

export const ERC20_BRIDGED_CONSTANTS = {
  NAME: "Wrapped liquid staked Ether 2.0",
  SYMBOL: "wstETH",
  DECIMALS: 18,
};
