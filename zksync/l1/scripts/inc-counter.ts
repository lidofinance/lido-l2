/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { Deployer } from './deploy';
import { Contract, Wallet } from 'ethers';

import { richWallet } from './rich_wallet';
import { web3Provider } from './utils';
import { parseEther } from 'ethers/lib/utils';

const provider = web3Provider();

const COUNTER_ADDRESS = '0x163CFa0911B9C7166b2608F0E902Fcd341523552';

// L1 to L1
async function main() {
	const wallet = new Wallet(richWallet[0].privateKey, provider);

	const CounterContract = new Contract(
		COUNTER_ADDRESS,
		counterContract.abi,
		wallet
	);

	const gasPrice = await provider.getGasPrice();

	const deployer = new Deployer({
		deployWallet: wallet,
		governorAddress: wallet.address,
		verbose: true,
	});

	const governorAgent = deployer.defaultGovernanceAgent(wallet);
	console.log('governorAgent:', governorAgent.address);

	console.log(
		'CounterContract value before Incrementing:',
		await (await CounterContract.value()).toString()
	);

	const counterInterface = new ethers.utils.Interface(counterContract.abi);

	const dataToIncrement = counterInterface.encodeFunctionData('increment', []);

	const tx = await governorAgent.execute(
		COUNTER_ADDRESS,
		parseEther('0.00001'),
		dataToIncrement,
		{
			gasPrice,
			gasLimit: 10_000_000,
		}
	);
	await tx.wait();
	console.log(
		'CounterContract value after Incrementing:',
		await (await CounterContract.value()).toString()
	);
}

const counterContract = {
	_format: 'hh-sol-artifact-1',
	contractName: 'Counter',
	sourceName: 'contracts/Counter.sol',
	abi: [
		{
			inputs: [],
			stateMutability: 'nonpayable',
			type: 'constructor',
		},
		{
			inputs: [],
			name: 'increment',
			outputs: [],
			stateMutability: 'payable',
			type: 'function',
		},
		{
			inputs: [],
			name: 'value',
			outputs: [
				{
					internalType: 'uint256',
					name: '',
					type: 'uint256',
				},
			],
			stateMutability: 'view',
			type: 'function',
		},
	],
	bytecode:
		'0x6080604052600160005534801561001557600080fd5b50610173806100256000396000f3fe6080604052600436106100295760003560e01c80633fa4f2451461002e578063d09de08a14610059575b600080fd5b34801561003a57600080fd5b50610043610063565b604051610050919061009d565b60405180910390f35b610061610069565b005b60005481565b600160008082825461007b91906100e7565b92505081905550565b6000819050919050565b61009781610084565b82525050565b60006020820190506100b2600083018461008e565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60006100f282610084565b91506100fd83610084565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff03821115610132576101316100b8565b5b82820190509291505056fea2646970667358221220bd73da51e7d45fac254aab80650edf8b92b9b798c0784b0dbde9f7fe848b00b264736f6c634300080f0033',
	deployedBytecode:
		'0x6080604052600436106100295760003560e01c80633fa4f2451461002e578063d09de08a14610059575b600080fd5b34801561003a57600080fd5b50610043610063565b604051610050919061009d565b60405180910390f35b610061610069565b005b60005481565b600160008082825461007b91906100e7565b92505081905550565b6000819050919050565b61009781610084565b82525050565b60006020820190506100b2600083018461008e565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60006100f282610084565b91506100fd83610084565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff03821115610132576101316100b8565b5b82820190509291505056fea2646970667358221220bd73da51e7d45fac254aab80650edf8b92b9b798c0784b0dbde9f7fe848b00b264736f6c634300080f0033',
	linkReferences: {},
	deployedLinkReferences: {},
};

main().catch((error) => {
	throw error;
});
