/* eslint-disable prettier/prettier */
import { ethers } from 'ethers';

export function web3Url() {
	return process.env.ETH_CLIENT_WEB3_URL as string;
}

export function web3Provider() {
	const provider = new ethers.providers.JsonRpcProvider(web3Url());

	// Check that `CHAIN_ETH_NETWORK` variable is set. If not, it's most likely because
	// the variable was renamed. As this affects the time to deploy contracts in localhost
	// scenario, it surely deserves a warning.
	const network = process.env.CHAIN_ETH_NETWORK;
	if (!network) {
		console.warn(
			'Network variable is not set. Check if contracts/scripts/utils.ts is correct'
		);
	}

	// Short polling interval for local network
	if (network === 'localhost') {
		provider.pollingInterval = 100;
	}

	return provider;
}

export function getAddressFromEnv(envName: string): string {
	const address = process.env[envName];
	if (!address) {
		return '';
	}
	if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
		throw new Error(
			`Incorrect address format hash in ${envName} env: ${address}`
		);
	}
	return address;
}
