/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
	REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
	getNumberFromEnv,
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

// zksync/l2/artifacts-zk/l2/contracts
const l2Artifacts = path.join(
	path.resolve(__dirname, '..', '..', 'l2'),
	'artifacts-zk/l2/contracts'
);

const l2ProxyArtifacts = path.join(l2Artifacts, 'proxy');

const tokenL2Artifact = path.join(l2Artifacts, 'token');

const L2_LIDO_BRIDGE_PROXY_BYTECODE = readBytecode(
	l2ProxyArtifacts,
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

const L2_STANDARD_ERC20_IMPLEMENTATION_BYTECODE = readBytecode(
	tokenL2Artifact,
	'ERC20Bridged'
);

const L2_STANDARD_ERC20_PROXY_BYTECODE = readBytecode(
	l2ProxyArtifacts,
	'OssifiableProxy'
);

const L2_STANDARD_ERC20_INTERFACE = readInterface(
	tokenL2Artifact,
	'ERC20Bridged'
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

			const deployer = new Deployer({
				deployWallet,
				governorAddress: deployWallet.address,
				verbose: true,
			});

			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			const zkSync = deployer.zkSyncContract(deployWallet);
			const governorAddress = await zkSync.getGovernor();
			console.log('Governor:', governorAddress);

			console.log('wstETH L1 token:', deployer.addresses.LidoToken);

			// const abiCoder = new ethers.utils.AbiCoder();
			// const priorityTxMaxGasLimit = getNumberFromEnv(
			// 	'CONTRACTS_PRIORITY_TX_MAX_GAS_LIMIT'
			// );

			// Bridge Proxy IMPL ADDRESS
			// const l2ERC20BridgeImplAddr = computeL2Create2Address(
			// 	applyL1ToL2Alias(lidoBridge.address),
			// 	L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE,
			// 	'0x',
			// 	ethers.constants.HashZero
			// );

			// const initFunction = L2_LIDO_BRIDGE_INTERFACE.getFunction(
			// 	'initialize(address,address,address)'
			// );
			// Bridge Proxy PARAMS
			// const l2BridgeProxyInitializationParams =
			// 	L2_LIDO_BRIDGE_INTERFACE.encodeFunctionData(initFunction, [
			// 		lidoBridge.address,
			// 		deployer.addresses.LidoToken,
			// 		deployer.addresses.LidoToken,
			// 	]);

			// Bridge Proxy ADDRESS
			// const l2ERC20BridgeProxyAddr = computeL2Create2Address(
			// 	applyL1ToL2Alias(lidoBridge.address),
			// 	L2_LIDO_BRIDGE_PROXY_BYTECODE,
			// 	ethers.utils.arrayify(
			// 		abiCoder.encode(
			// 			['address', 'address', 'bytes'],
			// 			[
			// 				l2ERC20BridgeImplAddr,
			// 				governorAddress,
			// 				l2BridgeProxyInitializationParams,
			// 			]
			// 		)
			// 	),
			// 	ethers.constants.HashZero
			// );

			// L2 TOKEN Implementation ADDRESS
			// const l2StandardToken = computeL2Create2Address(
			// 	l2ERC20BridgeProxyAddr,
			// 	L2_STANDARD_ERC20_IMPLEMENTATION_BYTECODE,
			// 	'0x',
			// 	ethers.constants.HashZero
			// );

			// L2 TOKEN PROXY ADDRESS
			// const l2TokenAddr = computeL2Create2Address(
			// 	l2ERC20BridgeProxyAddr,
			// 	L2_STANDARD_ERC20_PROXY_BYTECODE,
			// 	ethers.utils.arrayify(
			// 		abiCoder.encode(
			// 			['address', 'address'],
			// 			[deployer.addresses.LidoToken, l2StandardToken]
			// 		)
			// 	),
			// 	ethers.constants.HashZero
			// );

			const requiredValueToInitializeBridge =
				await zkSync.l2TransactionBaseCost(
					gasPrice,
					DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT,
					REQUIRED_L2_GAS_PRICE_PER_PUBDATA
				);

			// const requiredValueToPublishBytecodes =
			// 	await zkSync.l2TransactionBaseCost(
			// 		gasPrice,
			// 		priorityTxMaxGasLimit,
			// 		REQUIRED_L2_GAS_PRICE_PER_PUBDATA
			// 	);

			try {
				console.log('Initializing bridges');
				const tx = await lidoBridge[
					'initialize(bytes[],address,address,address,uint256,uint256)'
				](
					[
						L2_LIDO_BRIDGE_IMPLEMENTATION_BYTECODE,
						L2_LIDO_BRIDGE_PROXY_BYTECODE,
					],
					deployer.addresses.LidoToken,
					deployer.addresses.LidoToken,
					governorAddress,
					requiredValueToInitializeBridge,
					requiredValueToInitializeBridge,
					{
						gasPrice,
						nonce: nonce,
						value: requiredValueToInitializeBridge.mul(2),
						gasLimit: 10000000,
					}
				);

				const receipt = await tx.wait();
				console.log(
					`Lido bridge initialized, L2 Bridge Address: `,
					await lidoBridge.l2Bridge()
				);
				console.log(`Gas used: `, receipt.gasUsed.toString());
			} catch (err) {
				console.log('Error', err);
			}
		});

	await program.parseAsync(process.argv);
}

main().catch((err) => {
	throw new Error('Error:' + err);
});
