/* eslint-disable prettier/prettier */

import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { web3Provider } from './utils';
import { Command } from 'commander';
import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Deployer } from './deploy';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const provider = web3Provider();

async function main() {
	const program = new Command();

	program
		.version('0.1.0')
		.name('deploy-bridges')
		.description('deploy bridges on L1 & L2');

	program
		.option('--private-key <private-key>')
		.option('--gas-price <gas-price>')
		.option('--nonce <nonce>')
		.option('--governor-address <governor-address>')
		.option('--create2-salt <create2-salt>')
		.action(async (cmd) => {
			const deployWallet = cmd.privateKey
				? new Wallet(cmd.privateKey, provider)
				: new Wallet(PRIVATE_KEY, provider);

			console.log(`Using deployer wallet: ${deployWallet.address}`);

			const governorAddress = cmd.governorAddress
				? cmd.governorAddress
				: deployWallet.address;
			console.log(`Using governor address: ${governorAddress}`);

			const gasPrice = cmd.gasPrice
				? parseUnits(cmd.gasPrice, 'gwei')
				: await provider.getGasPrice();
			console.log(`Using gas price: ${formatUnits(gasPrice, 'gwei')} gwei`);

			const nonce = cmd.nonce
				? parseInt(cmd.nonce)
				: await deployWallet.getTransactionCount();
			console.log(`Using nonce: ${nonce}`);

			const create2Salt = cmd.create2Salt
				? cmd.create2Salt
				: ethers.utils.hexlify(ethers.utils.randomBytes(32));

			const deployer = new Deployer({
				deployWallet,
				governorAddress,
				verbose: true,
			});

			await deployer.deployLidoBridgeContracts(create2Salt, gasPrice);
		});
	await program.parseAsync(process.argv);
}

main().catch((error) => {
	throw error;
});
