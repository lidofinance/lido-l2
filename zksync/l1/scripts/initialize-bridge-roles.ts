/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
	REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
	getNumberFromEnv,
	readInterface,
	web3Provider,
	zkSyncUrl,
} from './utils';
import { richWallet } from './rich_wallet';
import { Wallet } from 'ethers';
import { formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';
import { L1ERC20Bridge__factory } from '../typechain/factories/l1/contracts/L1ERC20Bridge__factory';
import { Wallet as ZkSyncWallet, Provider, utils, Contract } from 'zksync-web3';
import ZkSyncBridgeExecutorUpgradable from '../../l2/artifacts-zk/l2/contracts/governance/ZkSyncBridgeExecutorUpgradable.sol/ZkSyncBridgeExecutorUpgradable.json';

// import * as path from 'path';

// const l2Artifacts = path.join(
// 	path.resolve(__dirname, '..', '..', 'l2'),
// 	'artifacts-zk/l2/contracts'
// );

// const L2_LIDO_BRIDGE_INTERFACE = readInterface(l2Artifacts, 'L2ERC20Bridge');

const provider = web3Provider();
const zkProvider = new Provider(zkSyncUrl(), 270);

const wallet = new Wallet(richWallet[0].privateKey, provider);

async function main() {
	const program = new Command();

	program.version('0.1.0').name('initialize-bridge-roles');

	program
		.option('--private-key <private-key>')
		.option('--gas-price <gas-price>')
		.option('--nonce <nonce>')
		.option('--lido-bridge <lido-bridge>')
		.action(async (cmd) => {
			const deployWallet = cmd.privateKey
				? new Wallet(cmd.privateKey, provider)
				: wallet;

			const zkWallet = cmd.privateKey
				? new ZkSyncWallet(cmd.privateKey, zkProvider)
				: new ZkSyncWallet(richWallet[0].privateKey, zkProvider);

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
			const priorityTxMaxGasLimit = getNumberFromEnv(
				'CONTRACTS_PRIORITY_TX_MAX_GAS_LIMIT'
			);

			const zkSync = deployer.zkSyncContract(deployWallet);

			// const create2Salt = cmd.create2Salt
			// 	? cmd.create2Salt
			// 	: ethers.utils.hexlify(ethers.utils.randomBytes(32));

			// await deployer.deployGovernanceAgent(create2Salt, {
			// 	gasPrice,
			// 	nonce,
			// });

			// get governor agent
			const governorAgent = deployer.defaultGovernanceAgent(wallet);
			console.log('GOV AGENT', governorAgent.address);

			// // get L1 bridge
			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			// // get bytecode for DEFAULT_ADMIN_ROLE
			const DEFAULT_ADMIN_ROLE = await lidoBridge.DEFAULT_ADMIN_ROLE();

			// check if deployer is admin of L1 LIdo bridge
			const hasAdminRole = await lidoBridge.hasRole(
				DEFAULT_ADMIN_ROLE,
				deployWallet.address
			);

			// // if deployer is not an admin, initialize admin to be deployer
			if (!hasAdminRole) {
				console.log('Initialize Admin');
				const tx = await lidoBridge['initialize(address)'](
					deployWallet.address
				);
				await tx.wait();
				console.log('DEFAULT_ADMIN_ROLE BELONGS TO', deployWallet.address);
			} else {
				console.log('DEPLOYER IS ALREADY AN ADMIN');
			}

			// get bytecode for DEPOSITS_ENABLER_ROLE
			// const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();

			// check if governor has DEPOSITS_ENABLER_ROLE role
			// const hasGovernorDepositEnablerRole = await lidoBridge.hasRole(
			// 	DEPOSITS_ENABLER_ROLE,
			// 	deployer.addresses.GovernanceL1
			// );

			// if (!hasGovernorDepositEnablerRole) {
			// 	console.log('GRANT DEPOSITS_ENABLER_ROLE TO THE GOVERNOR');
			// 	// grant DEPOSITS_ENABLER_ROLE role to the deployer
			// 	const tx = await lidoBridge.grantRole(
			// 		DEPOSITS_ENABLER_ROLE,
			// 		deployer.addresses.GovernanceL1,
			// 		{ gasPrice, gasLimit: 10_000_000 }
			// 	);
			// 	await tx.wait();

			// 	await lidoBridge.hasRole(
			// 		DEPOSITS_ENABLER_ROLE,
			// 		deployer.addresses.GovernanceL1
			// 	);
			// 	console.log('GOVERNOR GOT DEPOSITS_ENABLER_ROLE');
			// } else {
			// 	console.log('GOVERNOR HAS DEPOSITS_ENABLER_ROLE');
			// }

			// get interfaces
			const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;

			const IL1ERC20Bridge = new ethers.utils.Interface(L1ERC20BridgeAbi);

			// const isDepositEnabled = await lidoBridge.isDepositsEnabled();
			// if (!isDepositEnabled) {
			// 	const data = IL1ERC20Bridge.encodeFunctionData('enableDeposits', []);

			// 	const govTx = await governorAgent.execute(lidoBridge.address, 0, data, {
			// 		gasLimit: 10_000_000,
			// 	});

			// 	await govTx.wait();
			// 	console.log('Is deposit enable', await lidoBridge.isDepositsEnabled());
			// } else {
			// 	console.log('DEPOSITS ARE ALREADY ENABLED');
			// }

			console.log(
				'==========================L2======================================'
			);

			const counterInterface = new ethers.utils.Interface([
				'function increment()',
			]);

			const dataToIncrement = counterInterface.encodeFunctionData(
				'increment',
				[]
			);

			const gasLimitToIncrement = await zkProvider.estimateL1ToL2Execute({
				contractAddress: '0xf2E854A9ffA62D95eE2fdB103dF89df69FD598b0',
				calldata: dataToIncrement,
				caller: utils.applyL1ToL2Alias(governorAgent.address),
			});

			const baseCostToIncrement = await zkSync.l2TransactionBaseCost(
				gasPrice,
				gasLimitToIncrement,
				utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
			);

			console.log('BASE COST');

			// get target L2 contract address
			const requestL2TransactionEncodedToIncrement =
				zkSync.interface.encodeFunctionData('requestL2Transaction', [
					'0xf2E854A9ffA62D95eE2fdB103dF89df69FD598b0',
					0,
					dataToIncrement,
					gasLimitToIncrement,
					utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
					[new Uint8Array()],
					deployWallet.address,
				]);

			const txToInc = await governorAgent.execute(
				zkSync.address,
				baseCostToIncrement,
				requestL2TransactionEncodedToIncrement,
				{
					gasPrice,
					gasLimit: gasLimitToIncrement,
				}
			);

			await txToInc.wait();

			// const IZkSyncBridgeExecutorUpgradable = new ethers.utils.Interface(
			// 	ZkSyncBridgeExecutorUpgradable.abi
			// );

			// const data = IZkSyncBridgeExecutorUpgradable.encodeFunctionData('queue', [
			// 	[deployer.addresses.Bridges.LidoL2BridgeProxy],
			// 	[ethers.utils.parseEther('0')],
			// 	['enableDeposits()'],
			// 	[new Uint8Array()],
			// 	[false],
			// ]);

			// const gasLimit = await zkProvider.estimateL1ToL2Execute({
			// 	contractAddress: deployer.addresses.ZkGovernanceExecutor,
			// 	calldata: data,
			// 	caller: utils.applyL1ToL2Alias(governorAgent.address),
			// });

			// const baseCost = await zkSync.l2TransactionBaseCost(
			// 	gasPrice,
			// 	gasLimit,
			// 	utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
			// );

			// console.log(ethers.utils.formatEther(baseCost));

			// // get target L2 contract address
			// const requestL2TransactionEncoded = zkSync.interface.encodeFunctionData(
			// 	'requestL2Transaction',
			// 	[
			// 		deployer.addresses.ZkGovernanceExecutor,
			// 		0,
			// 		data,
			// 		gasLimit,
			// 		utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
			// 		[new Uint8Array()],
			// 		deployWallet.address,
			// 	]
			// );

			// const govBalance = await provider.getBalance(governorAgent.address);

			// if (govBalance < baseCost) {
			// 	const txSend = await deployWallet.sendTransaction({
			// 		to: governorAgent.address,
			// 		value: baseCost,
			// 		gasLimit: 10_000_000,
			// 		gasPrice,
			// 	});
			// 	await txSend.wait();
			// 	console.log(
			// 		'L1 GOV BALANCE',
			// 		(await provider.getBalance(governorAgent.address)).toString()
			// 	);
			// }

			// const tx = await governorAgent.execute(
			// 	zkSync.address,
			// 	baseCost,
			// 	requestL2TransactionEncoded,
			// 	{
			// 		gasPrice,
			// 		gasLimit,
			// 	}
			// );

			// await tx.wait();

			// zkSync.requestL2Transaction(
			// 	ethers.constants.AddressZero,
			// 	0,
			// 	'0x',
			// 	priorityTxMaxGasLimit,
			// 	REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
			// 	[L2_WETH_PROXY_BYTECODE, L2_WETH_IMPLEMENTATION_BYTECODE],
			// 	deployWallet.address,
			// 	{ gasPrice, nonce, value: requiredValueToPublishBytecodes }
			// ),
		});

	await program.parseAsync(process.argv);
}

main().catch((error) => {
	throw error;
});
