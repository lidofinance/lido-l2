/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { Wallet } from 'ethers';
import { web3Provider } from './utils';
import { richWallet } from './rich_wallet';

const provider = web3Provider();
const wallet = new Wallet(richWallet[0].privateKey, provider);

async function main() {
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
