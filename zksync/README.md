# Deployment plan

l1:
```bash
npm run deploy-mock-agent (local-setup)
```
- copy to l1/.env:
    - CONTRACTS_L1_GOVERNANCE_AGENT_ADDR=

```bash
npm run deploy-l1-executor
```
- copy to l1/.env:
    - L1_EXECUTOR_ADDR=
- copy to l2/.env:
    - L1_EXECUTOR_ADDR=


l2:
```bash
npm run deploy-governance-bridge
```
- copy to l1/.env:
    - L2_BRIDGE_EXECUTOR_ADDR=
- copy to l2/.env:
    - L2_BRIDGE_EXECUTOR_ADDR=

l1:
```bash
npm run deploy-bridges
```
- copy to l1/.env:
    - CONTRACTS_L1_LIDO_TOKEN_ADDR=
    - CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR=
    - CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR=

l2:
```bash
npm run deploy-wsteth-token
```
- copy to l1/.env:
    - CONTRACTS_L2_LIDO_TOKEN_ADDR=
- copy to l2/.env:
    - CONTRACTS_L2_LIDO_TOKEN_ADDR=

l1:
```bash
npm run initialize-bridges
```
- copy to l1/.env:
    - CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR=
- copy to l2/.env:
    - CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR=

l2:
```bash
npm run connect-token-to-bridge
```

l1:
```bash
npm run init-bridge-roles
```
```bash
npm run enable-deposits
```
```bash
npm run enable-withdrawals
```
