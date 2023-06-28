/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { Wallet } from 'ethers';
import { web3Provider } from './utils';

const provider = web3Provider();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
	const wallet = new Wallet(PRIVATE_KEY, provider);
	const L1Executor = await ethers.getContractFactory('L1Executor', wallet);
	const contract = await L1Executor.deploy();
	await contract.deployed();

	console.log(
		`L1Executor contract was successfully deployed at ${contract.address}`
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
