/* eslint-disable prettier/prettier */
import { web3Provider } from './utils/utils';
import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';

// L2
import { Wallet as ZkSyncWallet, Provider, Contract } from 'zksync-web3';
import L2ERC20Bridge from '../../l2/artifacts-zk/l2/contracts/L2ERC20Bridge.sol/L2ERC20Bridge.json';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ZK_CLIENT_WEB3_URL = process.env.ZK_CLIENT_WEB3_URL || '';

const L2_BRIDGE_EXECUTOR_ADDR = '0x3ccA24e1A0e49654bc3482ab70199b7400eb7A3a';

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
				: new ZkSyncWallet(PRIVATE_KEY, zkProvider);

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

			const lidoBridge = cmd.lidoBridge
				? deployer.defaultLidoBridge(deployWallet).attach(cmd.lidoBridge)
				: deployer.defaultLidoBridge(deployWallet);

			console.log(`Using L1 Bridge: ${lidoBridge.address}`);

			const L1GovernorAgent = deployer.defaultGovernanceAgent(deployWallet);

			console.log('Using L1 Governor Agent: ', L1GovernorAgent.address);

			const L2Bridge = new Contract(
				deployer.addresses.Bridges.LidoL2BridgeProxy,
				L2ERC20Bridge.abi,
				zkWallet
			);

			// get bytecode for roles
			const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();
			const DEPOSITS_DISABLER_ROLE = await lidoBridge.DEPOSITS_DISABLER_ROLE();
			const WITHDRAWALS_ENABLER_ROLE =
				await lidoBridge.WITHDRAWALS_ENABLER_ROLE();
			const WITHDRAWALS_DISABLER_ROLE =
				await lidoBridge.WITHDRAWALS_DISABLER_ROLE();

			console.log('\n===============L1===============');

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

			console.log('\n===============L2===============');

			await initializeBridgingManager(
				L2Bridge,
				'DEFAULT_ADMIN_ROLE',
				zkWallet.address
			);
			await grantRole(
				L2Bridge,
				DEPOSITS_ENABLER_ROLE,
				'DEPOSITS_ENABLER_ROLE',
				L2_BRIDGE_EXECUTOR_ADDR
			);
			await grantRole(
				L2Bridge,
				DEPOSITS_DISABLER_ROLE,
				'DEPOSITS_DISABLER_ROLE',
				L2_BRIDGE_EXECUTOR_ADDR
			);
			await grantRole(
				L2Bridge,
				WITHDRAWALS_ENABLER_ROLE,
				'WITHDRAWALS_ENABLER_ROLE',
				L2_BRIDGE_EXECUTOR_ADDR
			);
			await grantRole(
				L2Bridge,
				WITHDRAWALS_DISABLER_ROLE,
				'WITHDRAWALS_DISABLER_ROLE',
				L2_BRIDGE_EXECUTOR_ADDR
			);
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
