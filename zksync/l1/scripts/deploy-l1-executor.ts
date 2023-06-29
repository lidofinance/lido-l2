/* eslint-disable prettier/prettier */
import { web3Provider } from './utils/utils';
import { OssifiableProxy__factory } from '../typechain/index';
import { L1Executor__factory } from '../typechain/index';
import { Wallet } from 'ethers';

const provider = web3Provider();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
	// without ethers.Wallet -> HardhatError: HH5: HardhatContext is not created.
	const wallet = new Wallet(PRIVATE_KEY, provider);

	const L1ExecutorContractImpl = await new L1Executor__factory(wallet).deploy();

	console.log(`L1Executor implementation:${L1ExecutorContractImpl.address}`);

	const L1ExecutorContractProxy = await new OssifiableProxy__factory(
		wallet
	).deploy(L1ExecutorContractImpl.address, wallet.address, '0x', {
		gasLimit: 10_000_000,
	});

	console.log(`L1Executor proxy:${L1ExecutorContractProxy.address}`);
}

main().catch((error) => {
	throw error;
});
