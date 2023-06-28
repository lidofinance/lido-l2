/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { web3Provider } from './utils';
import { richWallet } from './rich_wallet';
import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';

// typechain
import { L1ERC20Bridge__factory } from '../typechain/factories/l1/contracts/L1ERC20Bridge__factory';
import { L1Executor__factory } from '../typechain/factories/l1/contracts/governance/L1Executor__factory';

// L2
import { Wallet as ZkSyncWallet, Provider, utils, Contract } from 'zksync-web3';
import ZkSyncBridgeExecutorUpgradable from '../../l2/artifacts-zk/l2/contracts/governance/ZkSyncBridgeExecutorUpgradable.sol/ZkSyncBridgeExecutorUpgradable.json';
import L2ERC20Bridge from '../../l2/artifacts-zk/l2/contracts/L2ERC20Bridge.sol/L2ERC20Bridge.json';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL || '';

const L1_EXECUTOR_ADDR = '0x52281EE6681AbAbeBc680A006114B4Dd72a9C7A3';
const L2_EXECUTOR = '0x3ccA24e1A0e49654bc3482ab70199b7400eb7A3a';

const provider = web3Provider();
const zkProvider = new Provider(ZK_CLIENT_WEB3_URL, 270);

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
				: new Wallet(PRIVATE_KEY, provider);

			const zkWallet = cmd.privateKey
				? new ZkSyncWallet(cmd.privateKey, zkProvider)
				: new ZkSyncWallet(richWallet[0].privateKey, zkProvider);

			console.log(`Using deployer wallet: ${deployWallet.address}`);

			const gasPrice = cmd.gasPrice
				? parseUnits(cmd.gasPrice, 'gwei')
				: await provider.getGasPrice();

			console.log(`Using gas price: ${formatUnits(gasPrice, 'gwei')} gwei`);

			const deployer = new Deployer({
				deployWallet,
				governorAddress: deployWallet.address,
				verbose: true,
			});

			// get L1 bridge
			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			// get governor agent
			const L1GovernorAgent = deployer.defaultGovernanceAgent(deployWallet);
			console.log('L1 Governor Agent address:', L1GovernorAgent.address);

			const zkSync = deployer.zkSyncContract(deployWallet);

			const L1Executor = L1Executor__factory.connect(
				L1_EXECUTOR_ADDR,
				deployWallet
			);

			const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;

			const IL1ERC20Bridge = new ethers.utils.Interface(L1ERC20BridgeAbi);

			const L2Bridge = new Contract(
				deployer.addresses.Bridges.LidoL2BridgeProxy,
				L2ERC20Bridge.abi,
				zkWallet
			);

			const ZkGovBridge = new Contract(
				L2_EXECUTOR,
				ZkSyncBridgeExecutorUpgradable.abi,
				zkWallet
			);

			const IZkSyncBridgeExecutorUpgradable = new ethers.utils.Interface(
				ZkSyncBridgeExecutorUpgradable.abi
			);

			console.log(
				'\n======================================L1======================================'
			);

			// get bytecode for roles
			const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();
			const DEPOSITS_DISABLER_ROLE = await lidoBridge.DEPOSITS_DISABLER_ROLE();
			const WITHDRAWALS_ENABLER_ROLE =
				await lidoBridge.WITHDRAWALS_ENABLER_ROLE();
			const WITHDRAWALS_DISABLER_ROLE =
				await lidoBridge.WITHDRAWALS_DISABLER_ROLE();

			// ===========INITIALIZE ROLE==============

			await initializeBridgingManager(
				lidoBridge,
				'DEFAULT_ADMIN_ROLE',
				deployWallet.address
			);
			await grantRole(
				lidoBridge,
				DEPOSITS_ENABLER_ROLE,
				'DEPOSITS_ENABLER_ROLE',
				deployer.addresses.GovernanceL1
			);
			await grantRole(
				lidoBridge,
				DEPOSITS_DISABLER_ROLE,
				'DEPOSITS_DISABLER_ROLE',
				deployer.addresses.GovernanceL1
			);
			await grantRole(
				lidoBridge,
				WITHDRAWALS_ENABLER_ROLE,
				'WITHDRAWALS_ENABLER_ROLE',
				deployer.addresses.GovernanceL1
			);
			await grantRole(
				lidoBridge,
				WITHDRAWALS_DISABLER_ROLE,
				'WITHDRAWALS_DISABLER_ROLE',
				deployer.addresses.GovernanceL1
			);

			const isDepositEnabledOnL1 = await lidoBridge.isDepositsEnabled();

			if (!isDepositEnabledOnL1) {
				const data = IL1ERC20Bridge.encodeFunctionData('enableDeposits', []);
				const enableDepositsTx = await L1GovernorAgent.execute(
					lidoBridge.address,
					0,
					data,
					{
						gasLimit: 10_000_000,
					}
				);

				await enableDepositsTx.wait();
			}
			console.log(
				'\nDEPOSITS ENABLED ON L1 BRIDGE:',
				await lidoBridge.isDepositsEnabled()
			);

			console.log(
				'\n======================================L2======================================'
			);

			// ==========================INITIALIZE ROLE==========================

			await initializeBridgingManager(
				L2Bridge,
				'DEFAULT_ADMIN_ROLE',
				zkWallet.address
			);
			await grantRole(
				L2Bridge,
				DEPOSITS_ENABLER_ROLE,
				'DEPOSITS_ENABLER_ROLE',
				L2_EXECUTOR
			);
			await grantRole(
				L2Bridge,
				DEPOSITS_DISABLER_ROLE,
				'DEPOSITS_DISABLER_ROLE',
				L2_EXECUTOR
			);
			await grantRole(
				L2Bridge,
				WITHDRAWALS_ENABLER_ROLE,
				'WITHDRAWALS_ENABLER_ROLE',
				L2_EXECUTOR
			);
			await grantRole(
				L2Bridge,
				WITHDRAWALS_DISABLER_ROLE,
				'WITHDRAWALS_DISABLER_ROLE',
				L2_EXECUTOR
			);

			// ==========================BRIDGE DEPOSIT STATUS==========

			const isDepositEnableL2 = await L2Bridge.isDepositsEnabled();

			console.log('\nDEPOSITS ENABLED ON L2 BRIDGE:', isDepositEnableL2);

			// ==========================QUEUE==========================

			const data = IZkSyncBridgeExecutorUpgradable.encodeFunctionData('queue', [
				['0x237d956D141719b0Ef110785cf1c3C117F866716'],
				[ethers.utils.parseEther('0')],
				['enableDeposits()'],
				[new Uint8Array()],
				[false],
			]);

			const gasLimit = await zkProvider.estimateL1ToL2Execute({
				contractAddress: L2_EXECUTOR,
				calldata: data,
				caller: utils.applyL1ToL2Alias(L1Executor.address),
			});

			const baseCost = await zkSync.l2TransactionBaseCost(
				gasPrice,
				gasLimit,
				utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
			);

			const encodedDataQueue = L1Executor.interface.encodeFunctionData(
				'callZkSync',
				[
					zkSync.address,
					L2_EXECUTOR,
					data,
					gasLimit,
					utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
				]
			);

			// ==========================GOVERNOR EXECUTE==========================

			// send via governor agent
			const govTx = await L1GovernorAgent.execute(
				L1_EXECUTOR_ADDR,
				baseCost,
				encodedDataQueue,
				{ gasPrice, gasLimit: 10_000_000 }
			);

			await govTx.wait();

			const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
				govTx
			);
			await l2Response2.wait();

			console.log('Action Set Queued on L2');
			// ==========================ACTION SET EXECUTE==========================

			// const actionSetId = await ZkGovBridge.getActionsSetById(actionSetIdValue);

			// console.log('Action set by id:', actionSetId);

			// const executeAction = await ZkGovBridge.execute(actionSetIdValue, {
			// 	gasLimit: 10_000_000,
			// });

			// await executeAction.wait();
		});

	await program.parseAsync(process.argv);
}

async function grantRole(
	contract: Contract,
	roleBytecode: string,
	roleName: string,
	target: string
) {
	const hasL2ExecutorDepositDisablerRoleL2 = await contract.hasRole(
		roleBytecode,
		target
	);

	if (!hasL2ExecutorDepositDisablerRoleL2) {
		const tx = await contract.grantRole(roleBytecode, target, {
			gasLimit: 10_000_000,
		});
		await tx.wait();

		const isRoleGranted = await contract.hasRole(roleBytecode, target);
		if (!isRoleGranted) {
			console.warn(`Error granting ${roleName} to ${target}`);
		}
	}
	console.log(`${roleName}:${target}`);
}

async function initializeBridgingManager(
	contract: Contract,
	roleName: string,
	target: string
) {
	const isInitiated = await contract.isInitialized();

	if (!isInitiated) {
		console.log('Initializing L1 Bridge Default Admin...');
		const tx = await contract['initialize(address)'](target);
		await tx.wait();
	}
	console.log(`${roleName}:${target}`);
}

main().catch((error) => {
	throw error;
});
