/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { Command } from 'commander';
import { web3Provider } from './utils';

import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Deployer } from './deploy';

const provider = web3Provider();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
	const program = new Command();
	program
		.version('0.1.0')
		.name('deploy-mock-agent')
		.description('deploy mock L1 governance agent');

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

			await deployer.deployGovernanceAgent(create2Salt, {
				gasPrice,
				nonce,
			});
		});

	await program.parseAsync(process.argv);
}

main().catch((err) => {
	throw new Error('Error:' + err);
});
