import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import './tasks/fork-node';
import '@matterlabs/hardhat-zksync-solc';

import env from './utils/env';

dotenv.config();

const config: HardhatUserConfig = {
	zksolc: {
		version: '1.3.6',
		compilerSource: 'binary',
		settings: {
			isSystem: true,
		},
	},
	solidity: {
		compilers: [
			{
				version: '0.6.11',
				settings: {
					optimizer: {
						enabled: true,
						runs: 100,
					},
				},
			},
			{
				version: '0.8.10',
				settings: {
					optimizer: {
						enabled: true,
						runs: 100_000,
					},
				},
			},
			{
				version: '0.8.15',
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000,
					},
				},
			},
		],
	},
	networks: {
		// Ethereum Public Chains
		eth_mainnet: {
			url: env.string('RPC_ETH_MAINNET', ''),
		},
		eth_goerli: {
			url: env.string('RPC_ETH_GOERLI', ''),
		},
		eth_kovan: {
			url: env.string('RPC_ETH_KOVAN', ''),
		},
		eth_rinkeby: {
			url: env.string('RPC_ETH_RINKEBY', ''),
		},

		// Ethereum Fork Chains
		eth_mainnet_fork: {
			url: 'http://localhost:8545',
		},
		eth_goerli_fork: {
			url: 'http://localhost:8545',
		},
		eth_kovan_fork: {
			url: 'http://localhost:8545',
		},
		eth_rinkeby_fork: {
			url: 'http://localhost:8545',
		},

		// Arbitrum Public Chains
		arb_mainnet: {
			url: env.string('RPC_ARB_MAINNET', ''),
		},
		arb_goerli: {
			url: env.string('RPC_ARB_GOERLI', ''),
		},
		arb_rinkeby: {
			url: env.string('RPC_ARB_RINKEBY', ''),
		},

		// Arbitrum Fork Chains
		arb_mainnet_fork: {
			url: 'http://localhost:8546',
		},
		arb_goerli_fork: {
			url: 'http://localhost:8546',
		},
		arb_rinkeby_fork: {
			url: 'http://localhost:8546',
		},

		// Optimism Public Chains
		opt_mainnet: {
			url: env.string('RPC_OPT_MAINNET', ''),
		},
		opt_goerli: {
			url: env.string('RPC_OPT_GOERLI', ''),
		},
		opt_kovan: {
			url: env.string('RPC_OPT_KOVAN', ''),
		},

		// Optimism Fork Chains
		opt_mainnet_fork: {
			url: 'http://localhost:9545',
		},
		opt_goerli_fork: {
			url: 'http://localhost:9545',
		},
		opt_kovan_fork: {
			url: 'http://localhost:9545',
		},
	},
	gasReporter: {
		enabled: env.string('REPORT_GAS', 'false') !== 'false',
		currency: 'USD',
	},
	etherscan: {
		apiKey: {
			kovan: env.string('ETHERSCAN_API_KEY_ETH', ''),
			rinkeby: env.string('ETHERSCAN_API_KEY_ETH', ''),
			mainnet: env.string('ETHERSCAN_API_KEY_ETH', ''),
			goerli: env.string('ETHERSCAN_API_KEY_ETH', ''),
			arbitrumTestnet: env.string('ETHERSCAN_API_KEY_ARB', ''),
			arbitrumOne: env.string('ETHERSCAN_API_KEY_ARB', ''),
			optimisticKovan: env.string('ETHERSCAN_API_KEY_OPT', ''),
			optimisticEthereum: env.string('ETHERSCAN_API_KEY_OPT', ''),
		},
	},
	typechain: {
		externalArtifacts: [
			'./interfaces/**/*.json',
			'./utils/optimism/artifacts/*.json',
			'./utils/arbitrum/artifacts/*.json',
		],
	},
	mocha: {
		timeout: 20 * 60 * 60 * 1000, // 20 minutes for e2e tests
	},
};

export default config;
