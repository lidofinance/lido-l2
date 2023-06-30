/* eslint-disable prettier/prettier */
import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import "@nomiclabs/hardhat-waffle";

require('dotenv').config();

const ETH_NETWORK_URL = process.env.ETH_CLIENT_WEB3_URL as string;

const config: HardhatUserConfig = {
	solidity: {
		version: '0.8.15',
		settings: {
			optimizer: {
				enabled: true,
				runs: 100_000,
			},
		},
	},
	networks: {
		goerli: {
			url: ETH_NETWORK_URL,
			accounts: [
				'0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110',
			],
		},
	},

	paths: {
		root: '../',
		sources: 'l1/contracts',
		cache: 'l1/cache',
		artifacts: 'l1/artifacts',
	},
};

export default config;
