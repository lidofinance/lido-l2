# Lido L2

This project contains the implementation of the L2 ERC20 token bridges for Arbitrum and Optimism chains. The current solution allows transferring ERC20 tokens between L1 and L2 chains.

More detailed info about the bridging process might be found in the specifications for certain chains:

- [Lido's Arbitrum Gateway](https://github.com/lidofinance/lido-l2/blob/main/contracts/arbitrum/README.md).
- [Lido's Optimism Bridge](https://github.com/lidofinance/lido-l2/blob/main/contracts/optimism/README.md).

## Project Setup

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

## Create .env File

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Fill the newly created `.env` file with required variables

## Running Tests

### Unit tests:

To run unit tests use:

```bash
npm run test:unit
```

### Integration Tests:

Before running integration tests, run the hardhat forked nodes:

```bash
npm run fork:ethereum
npm run fork:optimism
npm run fork:arbitrum
```

Run the integration tests via:

```bash
npm run test:integration
```

## Measuring Test Coverage

To run coverage measurement for unit tests:

```bash
npm run coverage
```

## Deploying Contracts

Fill the required variables `PRIVATE_KEY`, `L1_NETWORK`, and `L2_NETWORK` in the `.env` file before the script execution.

### Deploying Arbitrum Gateway

Run the deployment of the ERC20 token gateway for Ethereum/Arbitrum chain:

```bash
npm run arbitrum:deploy-gateway
```

### Deploying Optimism Bridge

Run the deployment of the ERC20 token bridge for Ethereum/Optimism chain:

```bash
npm run optimism:deploy-bridge
```
