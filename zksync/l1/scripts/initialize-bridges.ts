/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
	REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
	applyL1ToL2Alias,
	computeL2Create2Address,
	getNumberFromEnv,
	hashL2Bytecode,
	web3Provider,
} from './utils';
import { richWallet } from './rich_wallet';
import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';

import * as fs from 'fs';
import * as path from 'path';

const provider = web3Provider();

// if using local setup for zkSync
const wallet = new ethers.Wallet(richWallet[0].privateKey, provider);

function readBytecode(path: string, fileName: string) {
	return JSON.parse(
		fs.readFileSync(`${path}/${fileName}.sol/${fileName}.json`, {
			encoding: 'utf-8',
		})
	).bytecode;
}

function readInterface(path: string, fileName: string) {
	const abi = JSON.parse(
		fs.readFileSync(`${path}/${fileName}.sol/${fileName}.json`, {
			encoding: 'utf-8',
		})
	).abi;
	return new ethers.utils.Interface(abi);
}

const l1Artifacts = path.join(
	path.dirname(__dirname),
	'artifacts/l1/contracts'
);

const l1ProxyArtifacts = path.join(l1Artifacts, 'proxy');

// zksync/l2/artifacts-zk/l2/contracts
const l2Artifacts = path.join(
	path.resolve(__dirname, '..', '..', 'l2'),
	'artifacts-zk/l2/contracts'
);

const L2_LIDO_BRIDGE_PROXY_BYTECODE = readBytecode(
	l1ProxyArtifacts,
	'OssifiableProxy'
);

const L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE = readBytecode(
	l2Artifacts,
	'L2ERC20Bridge'
);

const L2_LIDO_BRIDGE_INTERFACE = readInterface(l2Artifacts, 'L2ERC20Bridge');

const DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT = getNumberFromEnv(
	'CONTRACTS_DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT'
);

async function main() {
	const program = new Command();

	program.version('0.1.0').name('initialize-lido-bridges');

	program
		.option('--private-key <private-key>')
		.option('--gas-price <gas-price>')
		.option('--nonce <nonce>')
		.option('--lido-bridge <lido-bridge>')
		.action(async (cmd) => {
			const deployWallet = cmd.privateKey
				? new Wallet(cmd.privateKey, provider)
				: wallet;

			console.log(`Using deployer wallet: ${deployWallet.address}`);

			const gasPrice = cmd.gasPrice
				? parseUnits(cmd.gasPrice, 'gwei')
				: await provider.getGasPrice();
			console.log(`Using gas price: ${formatUnits(gasPrice, 'gwei')} gwei`);

			const nonce = cmd.nonce
				? parseInt(cmd.nonce)
				: await deployWallet.getTransactionCount();
			console.log(`Using nonce: ${nonce}`);

			const deployer = new Deployer({
				deployWallet,
				governorAddress: deployWallet.address,
				verbose: true,
			});

			const zkSync = deployer.zkSyncContract(deployWallet);

			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			const priorityTxMaxGasLimit = getNumberFromEnv(
				'CONTRACTS_PRIORITY_TX_MAX_GAS_LIMIT'
			);
			const governorAddress = await zkSync.getGovernor();
			const abiCoder = new ethers.utils.AbiCoder();

			console.log('governorAddress:', governorAddress);

			const l2ERC20BridgeImplAddr = computeL2Create2Address(
				applyL1ToL2Alias(lidoBridge.address),
				L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE,
				'0x',
				ethers.constants.HashZero
			);
			console.log('lidoBridge.address:', lidoBridge.address);

			// const l2BridgeProxyInitializationParams =
			// 	L2_LIDO_BRIDGE_INTERFACE.encodeFunctionData('initialize', [
			// 		lidoBridge.address,
			// 		deployer.addresses.LidoToken,
			// 		deployer.addresses.LidoToken,
			// 	]);

			// not sure about this
			// const l2ERC20BridgeProxyAddr = computeL2Create2Address(
			// 	applyL1ToL2Alias(lidoBridge.address),
			// 	L2_LIDO_BRIDGE_PROXY_BYTECODE,
			// 	ethers.utils.arrayify(
			// 		abiCoder.encode(
			// 			['address', 'address', 'bytes'],
			// 			[l2ERC20BridgeImplAddr, governorAddress, proxyInitializationParams]
			// 		)
			// 	),
			// 	ethers.constants.HashZero
			// );

			// const l2StandardToken = computeL2Create2Address(
			// 	l2ERC20BridgeProxyAddr,
			// 	L2_STANDARD_ERC20_IMPLEMENTATION_BYTECODE,
			// 	'0x',
			// 	ethers.constants.HashZero
			// );
			// const l2TokenFactoryAddr = computeL2Create2Address(
			// 	l2ERC20BridgeProxyAddr,
			// 	L2_STANDARD_ERC20_PROXY_FACTORY_BYTECODE,
			// 	ethers.utils.arrayify(abiCoder.encode(['address'], [l2StandardToken])),
			// 	ethers.constants.HashZero
			// );

			// There will be two deployments done during the initial initialization
			const requiredValueToInitializeBridge =
				await zkSync.l2TransactionBaseCost(
					gasPrice,
					DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT,
					REQUIRED_L2_GAS_PRICE_PER_PUBDATA
				);
			console.log(
				'requiredValueToInitializeBridge',
				requiredValueToInitializeBridge
			);
			// const requiredValueToPublishBytecodes =
			// 	await zkSync.l2TransactionBaseCost(
			// 		gasPrice,
			// 		priorityTxMaxGasLimit,
			// 		REQUIRED_L2_GAS_PRICE_PER_PUBDATA
			// 	);

			// const independentInitialization = [
			// zkSync.requestL2Transaction(
			// 	ethers.constants.AddressZero,
			// 	0,
			// 	'0x',
			// 	priorityTxMaxGasLimit,
			// 	REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
			// 	[
			// 		L2_STANDARD_ERC20_PROXY_FACTORY_BYTECODE,
			// 		L2_STANDARD_ERC20_IMPLEMENTATION_BYTECODE,
			// 	],
			// 	deployWallet.address,
			// 	{ gasPrice, nonce, value: requiredValueToPublishBytecodes }
			// ),

			// ];

			// const txs = await Promise.all(independentInitialization);
			// const receipts = await Promise.all(txs.map((tx) => tx.wait(2)));

			// console.log(`ERC20 bridge initialized, gasUsed: ${receipts}`);
			// console.log(
			// 	`CONTRACTS_L2_ERC20_BRIDGE_ADDR=${await lidoBridge.l2Bridge()}`
			// );

			try {
				const tx = await lidoBridge[
					'initialize(bytes[],address,uint256,uint256)'
				](
					[
						L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE,
						L2_LIDO_BRIDGE_PROXY_BYTECODE,
					],
					governorAddress,
					requiredValueToInitializeBridge,
					requiredValueToInitializeBridge,
					{
						gasPrice,
						// nonce: nonce + 1,
						value: requiredValueToInitializeBridge.mul(2),
					}
				);
				tx.wait();
			} catch (err) {
				// console.log(err);
			}
		});

	await program.parseAsync(process.argv);
}

main().catch((err) => {
	throw new Error('Error:' + err);
});
