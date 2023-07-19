# Deployment plan

l1:

```bash
npm run deploy-mock-agent (local-setup)
```

- copy to zksync/.env:
  - CONTRACTS_L1_GOVERNANCE_AGENT_ADDR=

```bash
npm run deploy-l1-executor
```

- copy to zksync/.env:
  - L1_EXECUTOR_ADDR=

l2:

```bash
npm run deploy-governance-bridge
```

- copy to zksync/.env:
  - L2_BRIDGE_EXECUTOR_ADDR=

l1:

```bash
npm run deploy-bridges
```

- copy to zksync/.env:
  - CONTRACTS_L1_LIDO_TOKEN_ADDR=
  - CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR=
  - CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR=

l2:

```bash
npm run deploy-wsteth-token
```

- copy to zksync/.env:
  - CONTRACTS_L2_LIDO_TOKEN_ADDR=

l1:

```bash
npm run initialize-bridges
```

- copy to zksync/.env:
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

# Statements

| Statement | Answer |
|--------------------------------|-------------------|
| It is possible to bridge wstETH forth and back using this bridge |Yes|
| The bridge using a canonical mechanism for message/value passing |Yes, canonical zkSync mechanism for callin L2 functions from L1 + canonical mechainsm to confirm txs from L2 on L1|
| The bridge is upgradeable |Yes, all parts of the wstETH bridge on L1 and L2 are deployed behind an OssifiableProxy. However, governance bridge components on L2 are not upgradable. Since the L2 executor (AAVE) contains <b>delegatecall</b> opcode which is not considered "upgrade safe" according to OZ docs.|
| Upgrade authority for the bridge |Only Aragon Agent on L1 (Lido DAO) has the permissions to change the implementation of the bridges (upgrade) and enable (disable) deposits (withdrawals) on L1 and L2 bridges (using cross-chain governance bridge). Additionaly, a multisig of guradians can be added which can cancel any upgrade or parameter setting call on L2 but cannot initiate them.|
| Emergency pause/cancel mechanisms and their authorities |There's deposit/withdrawal enabler roles on L1 and L2 part of the birdge that can be set to an address of the admin's choosing.|
| The bridged token support permits and ERC-1271 |Yes, L2 token is extended to support ERC20Permit which allows for approval to spend tokens to be performed using a message signed by the owner of the tokens and ERC1271 standards which allows for Smart Accounts (Account Abstraction) to interact with the token.|
| Are the following things in the scope of this bridge deployment: | |
| - Passing the (w)stETH/USD price feed | No |
| - Passing Lido DAO governance decisions | Yes, for uprgading the L2 part of bridge and enabling/disabling deposit/withdrawal.|
| Bridges are complicated in that the transaction can succeed on one side and fail on the other. What's the handling mechanism for this issue? | For deposits there is a way to claim failed deposits in case that tx passes on L1 but fails on L2. For withdrawals, if the tx passes on L2 and fails on L1, the funds will be burnt on L2 and locked on L1 bridge until someone passes the correct L2-L1 message inclusion proof to unlock the fund to L1 receiver.|
| Is there a deployment script that sets all the parameters and authorities correctly? | There is a deploy script but it takes the addresses from environment variables. TODO: make a release deployment script with hardcoded values | 
| Is there a post-deploy check script that, given a deployment, checks that all parameters and authorities are set correctly? | No. TODO: make a deployment check script |
