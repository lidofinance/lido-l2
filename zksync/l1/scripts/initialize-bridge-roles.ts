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
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';
import { L1ERC20Bridge__factory } from '../typechain/factories/l1/contracts/L1ERC20Bridge__factory';
import { Wallet as ZkSyncWallet, Provider, utils } from 'zksync-web3';

import * as path from 'path';

const l2Artifacts = path.join(
	path.resolve(__dirname, '..', '..', 'l2'),
	'artifacts-zk/l2/contracts'
);

const L2_LIDO_BRIDGE_INTERFACE = readInterface(l2Artifacts, 'L2ERC20Bridge');

const provider = web3Provider();
const zkProvider = new Provider(zkSyncUrl(), 270);

const wallet = new ethers.Wallet(richWallet[0].privateKey, provider);

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
			const priorityTxMaxGasLimit = getNumberFromEnv(
				'CONTRACTS_PRIORITY_TX_MAX_GAS_LIMIT'
			);

			const zkSync = deployer.zkSyncContract(deployWallet);
			const governorAddress = await zkSync.getGovernor();

			const create2Salt = cmd.create2Salt
				? cmd.create2Salt
				: ethers.utils.hexlify(ethers.utils.randomBytes(32));

			await deployer.deployGovernanceAgent(create2Salt, {
				gasPrice,
				nonce,
			});

			// get governor agent
			const governorAgent = deployer.defaultGovernanceAgent(wallet);

			// get L1 bridge
			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			// get bytecode for DEFAULT_ADMIN_ROLE
			const DEFAULT_ADMIN_ROLE = await lidoBridge.DEFAULT_ADMIN_ROLE();

			// check if deployer is admin of L1 LIdo bridge
			const hasAdminRole = await lidoBridge.hasRole(
				DEFAULT_ADMIN_ROLE,
				deployWallet.address
			);

			// if deployer is not an admin, initialize admin to be deployer
			if (!hasAdminRole) {
				console.log('Initialize Admin');
				await lidoBridge['initialize(address)'](deployWallet.address);

				console.log('DEFAULT_ADMIN_ROLE BELONGS TO', deployWallet.address);
			} else {
				console.log('DEPLOYER IS ALREADY AN ADMIN');
			}

			// get bytecode for DEPOSITS_ENABLER_ROLE
			const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();

			// check if governor has DEPOSITS_ENABLER_ROLE role
			const hasGovernorDepositEnablerRole = await lidoBridge.hasRole(
				DEPOSITS_ENABLER_ROLE,
				deployer.addresses.GovernanceL1
			);

			if (!hasGovernorDepositEnablerRole) {
				console.log('GRANT DEPOSITS_ENABLER_ROLE TO THE GOVERNOR');
				// grant DEPOSITS_ENABLER_ROLE role to the deployer
				await lidoBridge.grantRole(
					DEPOSITS_ENABLER_ROLE,
					deployer.addresses.GovernanceL1,
					{ gasPrice, gasLimit: 10_000_000 }
				);

				await lidoBridge.hasRole(
					DEPOSITS_ENABLER_ROLE,
					deployer.addresses.GovernanceL1
				);
				console.log('GOVERNOR GOT DEPOSITS_ENABLER_ROLE');
			} else {
				console.log('GOVERNOR HAS DEPOSITS_ENABLER_ROLE');
			}

			// get interfaces
			const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;
			const IL1ERC20Bridge = new ethers.utils.Interface(L1ERC20BridgeAbi);

			const isDepositEnabled = await lidoBridge.isDepositsEnabled();
			if (!isDepositEnabled) {
				const data = IL1ERC20Bridge.encodeFunctionData('enableDeposits', []);

				const govTx = await governorAgent.execute(lidoBridge.address, 0, data, {
					gasLimit: 10_000_000,
				});

				const govTxRec = await govTx.wait();
				console.log('Tx statusL', govTxRec.status);
				console.log('Is deposit enable', await lidoBridge.isDepositsEnabled());
			} else {
				console.log('DEPOSITS ARE ALREADY ENABLED');
			}

			// IL2BridgeExecutor
			const ExecutorL2ABI = [
				'function queue(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, bool[] memory withDelegatecalls)',
			];
			const IExecutorL2ABI = new ethers.utils.Interface(ExecutorL2ABI);

			const enableDepositsFunction =
				IL1ERC20Bridge.getFunction('enableDeposits');

			// get signature for enableDeposits func
			const sig = IExecutorL2ABI.getSighash(enableDepositsFunction);

			// create fields to be encoded for queue function
			const targets = [deployer.addresses.Bridges.LidoL2BridgeProxy];
			const values = [0];
			const signatures = [sig];
			const calldatas = [] as any;
			const withDelegatecalls = [false];

			const data = IExecutorL2ABI.encodeFunctionData('queue', [
				targets,
				values,
				signatures,
				calldatas,
				withDelegatecalls,
			]);

			console.log(IExecutorL2ABI.decodeFunctionData('queue', data));

			const gasLimit = await zkProvider.estimateL1ToL2Execute({
				contractAddress: deployer.addresses.Bridges.LidoL2BridgeProxy,
				calldata: data,
				caller: utils.applyL1ToL2Alias(governorAddress),
			});

			const baseCost = await zkSync.l2TransactionBaseCost(
				gasPrice,
				priorityTxMaxGasLimit,
				utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
			);

			// get target L2 contract address
			const requestL2TransactionEncoded = zkSync.interface.encodeFunctionData(
				'requestL2Transaction',
				[
					ethers.constants.AddressZero,
					0,
					data,
					priorityTxMaxGasLimit,
					REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
					[],
					deployWallet.address,
				]
			);

			await governorAgent.execute(
				zkSync.address,
				baseCost,
				requestL2TransactionEncoded,
				{
					gasPrice,
					gasLimit,
				}
			);

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
