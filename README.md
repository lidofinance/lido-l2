# Lido L2

This project contains the implementations of the L2 ERC20 token bridges for Arbitrum and Optimism chains. The current solution allows transferring ERC20 tokens between L1 and L2 chains.

To retrieve more detailed info about the bridging process, see the specifications for certain chains:

- [Lido's Arbitrum Gateway](https://github.com/lidofinance/lido-l2/blob/main/contracts/arbitrum/README.md).
- [Lido's Optimism Bridge](https://github.com/lidofinance/lido-l2/blob/main/contracts/optimism/README.md).

## Project setup

1. Clone the repo:

```bash
git clone git@github.com:lidofinance/lido-l2.git
cd ./lido-l2
```

2. Install dependencies:

```bash
npm install
```

3. Compile the contracts:

```bash
npm run compile
```

## Configure ENV variables

The simplest way to create `.env` file is via cloning the `.env.example` file:

```bash
cp .env.example .env
```

Fill the newly created `.env` file with the required variables. See the [Project Configuration](#Project-Configuration) section for the complete list of configuration options.

## Bridge deployment

The configuration of the deployment scripts happens via the ENV variables. The following variables are required:

- [`TOKEN`](#TOKEN) - address of the token to deploy a new bridge on the Ethereum chain.
- [`NETWORK`](#NETWORK) - name of the network environments used by deployment scripts. Allowed values: `local`, `testnet`, `mainnet`.
- [`DEPLOYER_PRIVATE_KEY`](#DEPLOYER_PRIVATE_KEY) - Private key of the deployer account used during deployment process.
- [`L1_PROXY_ADMIN`](#L1_PROXY_ADMIN) - The address to grant admin rights of the `OssifiableProxy` on the L1 bridge
- [`L1_BRIDGE_ADMIN`](#L1_BRIDGE_ADMIN) - Address to grant the `DEFAULT_ADMIN_ROLE` on the L1 bridge
- [`L2_PROXY_ADMIN`](#L2_PROXY_ADMIN) - The address to grant admin rights of the `OssifiableProxy` on the L2 bridge
- [`L2_BRIDGE_ADMIN`](#L2_BRIDGE_ADMIN) - Address to grant the `DEFAULT_ADMIN_ROLE` on the L2 bridge

The following ENV variables are optional and might be used to make an additional setup of the bridge after the deployment:

- [`L1_DEPOSITS_ENABLED`](#L1_DEPOSITS_ENABLED) - whether the deposits are enabled on the L1 after the deployment. By default, deposits are disabled.
- [`L1_WITHDRAWALS_ENABLED`](#L1_WITHDRAWALS_ENABLED) - whether the withdrawals are enabled on the L1 after the deployment. By default, withdrawals are disabled.
- [`L1_DEPOSITS_ENABLERS`](#L1_DEPOSITS_ENABLERS) - array of addresses to grant `DEPOSITS_ENABLER_ROLE` on the L1 bridge.
- [`L1_DEPOSITS_DISABLERS`](#L1_DEPOSITS_DISABLERS) - array of addresses to grant `DEPOSITS_DISABLER_ROLE` on the L1 bridge.
- [`L1_WITHDRAWALS_ENABLERS`](#L1_WITHDRAWALS_ENABLES) - array of addresses to grant `WITHDRAWALS_ENABLER_ROLE` on the L1 bridge.
- [`L1_WITHDRAWALS_DISABLERS`](#L1_WITHDRAWALS_DISABLERS) - array of addresses to grant `WITHDRAWALS_DISABLER_ROLE` on the L1 bridge.
- [`L2_DEPOSITS_ENABLED`](#L2_DEPOSITS_ENABLED) - whether the deposits are enabled on the L2 after the deployment. By default, deposits are disabled.
- [`L2_WITHDRAWALS_ENABLED`](#L2_WITHDRAWALS_ENABLED) - whether the withdrawals are enabled on the L2 after the deployment. By default, deposits are disabled.
- [`L2_DEPOSITS_ENABLERS`](#L2_DEPOSITS_ENABLERS) - array of addresses to grant `DEPOSITS_ENABLER_ROLE` on the L2 bridge.
- [`L2_DEPOSITS_DISABLERS`](#L2_DEPOSITS_DISABLERS) - array of addresses to grant `DEPOSITS_DISABLER_ROLE` on the L2 bridge.
- [`L2_WITHDRAWALS_ENABLERS`](#L2_WITHDRAWALS_ENABLES) - array of addresses to grant `WITHDRAWALS_ENABLER_ROLE` on the L2 bridge.
- [`L2_WITHDRAWALS_DISABLERS`](#L2_WITHDRAWALS_DISABLERS) - array of addresses to grant `WITHDRAWALS_DISABLER_ROLE` on the L2 bridge.

### Deploying Arbitrum gateway

To run the deployment of the ERC20 token gateway for the Ethereum <-> Arbitrum chains use the following command:

```bash
npm run arbitrum:deploy
```

### Deploying Optimism bridge

To run the deployment of the ERC20 token gateway for the Ethereum <-> Optimism chains use the following command:

```bash
npm run optimism:deploy
```

## Tests running

### Unit tests

To run unit tests use one of the following commands:

```bash

# Run tests for both Arbitrum and Optimism bridges
npm run test:unit

# Run tests only for Arbitrum gateway
npm run arbitrum:test:unit

# Run tests only for Optimism bridge
npm run optimism:test:unit
```

### Integration tests

Before running integration tests, run the hardhat forked nodes in the standalone tabs:

```bash
# Required to run both Arbitrum and Optimism integraton tests
npm run fork:ethereum

# Required to run Optimism integration tests
npm run fork:optimism

# Required to run Arbitrum integration tests
npm run fork:arbitrum
```

The integration tests might be run via the following commands:

```bash
# Run integration tests for both Arbitrum and Optimism bridges
npm run test:integration

# Run integration tests for Arbitrum bridge
npm run arbitrum:test:integration

# Run integration tests for Optimism bridge
npm run optimism:test:integration
```

### E2E tests

E2E tests run on the real contracts deployed on the testnet networks. To run such tests the [`E2E_TESTER_PRIVATE_KEY`](#E2E_TESTER_PRIVATE_KEY) env variable must be set in the `.env` file.

To run E2E tests use the following commands:

```bash
# Run E2E tests for both Arbitrum and Optimism bridges
npm run test:e2e

# Run E2E tests for Arbitrum bridge
npm run arbitrum:test:e2e

# Run E2E tests for Optimism bridge
npm run optimism:test:e2e
```

### Acceptance tests

The acceptance tests might be run after the deployment to validate that the bridge was deployed with the correct parameters.

The following ENV variables must be set before the tests running:

- [`ERC20_BRIDGED`](#ERC20_BRIDGED) - Address of the proxied `ERC20Bridged` token in the Optimism network
- [`L1_ERC20_TOKEN_BRIDGE`](#L1_ERC20_TOKEN_BRIDGE) - Address of the proxied `L1ERC20TokenBridge` contract in the Ethereum network
- [`L2_ERC20_TOKEN_BRIDGE`](#L2_ERC20_TOKEN_BRIDGE) - Address of the proxied `L2ERC20TokenBridge` contract in the Optimism network

To run the acceptance tests, use the following commands:

```bash
# Optimism bridge
npm run optimism:test:acceptance

# Arbitrum bridge
npm run arbitrum:test:acceptance
```

## Code Coverage

To run coverage measurement for unit tests:

```bash
npm run coverage
```

## Project Configuration

The configuration of the project happens via set of ENV variables. The full list of the configured properties might be split in the following groups:

### RPCs

#### `RPC_URL_ETH_MAINNET`

Address of the RPC node for **Kovan** Ethereum testnet.

> Default value: `https://mainnet.infura.io/v3/<INFURA_API_KEY>`

#### `RPC_ETH_RINKEBY`

Address of the RPC node for **Mainnet** Ethereum network.

> Default value: `https://rinkeby.infura.io/v3/<INFURA_API_KEY>`

#### `RPC_ETH_KOVAN`

Address of the RPC node for **Kovan** Ethereum network.

> Default value: `https://kovan.infura.io/v3/<INFURA_API_KEY>`

#### `RPC_ARB_RINKEBY`

Address of the RPC node for **Rinkeby** Arbitrum network.

> Default value: `https://rinkeby.arbitrum.io/rpc`

#### `RPC_ARB_MAINNET`

> **Warning**
>
> Please, don't use the default value for production deployments! The default RPC node might not be available or fail suddenly during the request.

Address of the RPC node for **Mainnet** Arbitrum network.

> Default value: `https://arb1.arbitrum.io/rpc`

#### `RPC_OPT_KOVAN`

Address of the RPC node for **Kovan** Optimism network.

> Default value: `https://kovan.optimism.io`

#### `RPC_OPT_MAINNET`

> **Warning**
>
> Please, don't use the default value for production deployments! The default RPC node might not be available or fail suddenly during the request.

Address of the RPC node for **Mainnet** Optimism network.

> Default value: `https://mainnet.optimism.io`

### Etherscan

Below variables are required for successfull verification of the contracts on block explorer for certain networks.

#### `ETHERSCAN_API_KEY_ETH`

API key from the [Etherscan](https://etherscan.io/) block explorer. See details here: https://info.etherscan.com/api-keys/

#### `ETHERSCAN_API_KEY_ARB`

API key from the [Arbiscan](https://arbiscan.io/) block explorer.

#### `ETHERSCAN_API_KEY_OPT`

API key from the [Optimistic Ethereum](https://optimistic.etherscan.io/) block explorer.

### Bridge/Gateway Deployment

Below variables used in the Arbitrum/Optimism bridge deployment process.

#### `TOKEN`

Address of the token to deploy a new bridge on the Ethereum chain.

#### `NETWORK`

Name of the network environments used by deployment scripts. Might be one of: `local`, `testnet`, `mainnet`.

#### `DEPLOYER_PRIVATE_KEY`

Private key of the deployer account used during deployment process.

#### `L1_PROXY_ADMIN`

The address assigned as admin of the `OssifiableProxy` contract for `L1ERC20Bridge` / `L1ERC20Gateway`.

#### `L1_BRIDGE_ADMIN`

The address granted the `DEFAULT_ADMIN_ROLE` for `L1ERC20Bridge` / `L1ERC20Gateway`.

#### `L1_DEPOSITS_ENABLED`

> Default value: `false`

Whether the deposits enabled on the L1 after the deployment

#### `L1_WITHDRAWALS_ENABLED`

> Default value: `false`
> Whether the deposits enabled on the L1 after the deployment

#### `L1_DEPOSITS_ENABLERS`

> Default value: `[]`

The array of addresses to grant `DEPOSITS_ENABLER_ROLE` on L1 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L1_DEPOSITS_DISABLERS`

The array of addresses to grant `DEPOSITS_DISABLER_ROLE` on L1 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L1_WITHDRAWALS_ENABLES`

The array of addresses to grant `WITHDRAWALS_ENABLER_ROLE` on L1 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L1_WITHDRAWALS_DISABLERS`

The array of addresses to grant `WITHDRAWALS_DISABLER_ROLE`. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L2_PROXY_ADMIN`

The address assigned as admin of the `OssifiableProxy` contract for `L2ERC20Bridge` / `L2ERC20Gateway` and ERC20Bridged.

#### `L2_BRIDGE_ADMIN`

The address granted the `DEFAULT_ADMIN_ROLE` for `L2ERC20Bridge` / `L2ERC20Gateway`.

#### `L2_DEPOSITS_ENABLED`

> Default value: `false`

Whether the deposits enabled on the L2 after the deployment

#### `L2_WITHDRAWALS_ENABLED`

> Default value: `false`
> Whether the deposits enabled on the L2 after the deployment

#### `L2_DEPOSITS_ENABLERS`

> Default value: `[]`

The array of addresses to grant `DEPOSITS_ENABLER_ROLE` on L2 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L2_DEPOSITS_DISABLERS`

The array of addresses to grant `DEPOSITS_DISABLER_ROLE` on L2 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L2_WITHDRAWALS_ENABLES`

The array of addresses to grant `WITHDRAWALS_ENABLER_ROLE` on L2 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

#### `L2_WITHDRAWALS_DISABLERS`

The array of addresses to grant `WITHDRAWALS_DISABLER_ROLE` on L2 bridge/gateway. The value must be in the form of JSON array of strings. For example:
`["0x00000000219ab540356cbb839cbe05303d7705fa","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]`

### E2E Testing

The following variables are used in the process of the E2E testing.

#### `E2E_TESTER_PRIVATE_KEY`

The private key from the address which holds:

- Kovan and Optimismic Kovan Ether to launch Optimism E2E tests
- Rinkeby and Arbitrum Rinkeby Ether to launch Arbitrum E2E tests

The test Ether might be retrived via [Paradigm Faucet](https://faucet.paradigm.xyz/).

### Acceptance Test

Bellow variables are used to test the deployment of the ERC20 bridge for Arbitrum and Optimism

#### `ERC20_BRIDGED`

Address of the proxied `ERC20Bridged` token in the Optimism network

#### `L1_ERC20_TOKEN_BRIDGE`

Address of the proxied `L1ERC20TokenBridge` contract in the Ethereum network

#### `L2_ERC20_TOKEN_BRIDGE`

Address of the proxied `L2ERC20TokenBridge` contract in the Optimism network
