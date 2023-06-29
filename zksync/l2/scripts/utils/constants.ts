export const ADDRESSES = {
    ETHEREUM_GOVERNANCE_EXECUTOR: process.env.ETHEREUM_GOVERNANCE_EXECUTOR_ADDRESS as string,
    GUARDIAN: process.env.GUARDIAN_ADDRESS as string,
    L2_LIDO_BRIDGE_PROXY_ADDR: process.env.CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR as string,
    L2_LIDO_TOKEN_ADDR: process.env.CONTRACTS_L2_LIDO_TOKEN_ADDR as string,
    ZERO: '0x0000000000000000000000000000000000000000',
};

export const GOVERNANCE_CONSTANTS = {
    DELAY: process.env.EXECUTION_DELAY as string,
    GRACE_PERIOD: process.env.EXECUTION_GRACE_PERIOD as string,
    MIN_DELAY: process.env.EXECUTION_MIN_DELAY as string,
    MAX_DELAY: process.env.EXECUTION_MAX_DELAY as string,
};

export const ERC20_BRIDGED_CONSTANTS = {
    NAME: 'Wrapped liquid staked Ether 2.0',
    SYMBOL: 'wstETH',
    DECIMALS: 18
};
