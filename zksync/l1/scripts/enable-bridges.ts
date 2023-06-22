/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { web3Provider, zkSyncUrl } from './utils';
import { richWallet } from './rich_wallet';
import { Wallet } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Command } from 'commander';
import { Deployer } from './deploy';
import { Wallet as ZkSyncWallet, Provider, Contract } from 'zksync-web3';
import L2ERC20Bridge from '../../l2/artifacts-zk/l2/contracts/L2ERC20Bridge.sol/L2ERC20Bridge.json';

const provider = web3Provider();
const zkProvider = new Provider(zkSyncUrl(), 270);

const wallet = new ethers.Wallet(richWallet[0].privateKey, provider);

async function main() {
	const program = new Command();

	program.version('0.1.0').name('initialize-bridge-roles');

	program
		.option('--private-key <private-key>')
		.option('--private-key-zk <private-key-zk>')
		.option('--gas-price <gas-price>')
		.option('--nonce <nonce>')
		.option('--lido-bridge <lido-bridge>')
		.action(async (cmd) => {
			const deployWallet = cmd.privateKey
				? new Wallet(cmd.privateKey, provider)
				: wallet;

			const zkWallet = cmd.privateKey
				? new ZkSyncWallet(cmd.privateKeyZk, zkProvider)
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

			const isManagerInitialized = await lidoBridge.isInitialized();

			if (!isManagerInitialized) {
				await lidoBridge['initialize(address)'](deployWallet.address, {
					gasPrice,
					gasLimit: 10_000_000,
				});
			}

			// get bytecode for DEPOSITS_ENABLER_ROLE
			const DEPOSITS_ENABLER_ROLE = await lidoBridge.DEPOSITS_ENABLER_ROLE();
			// get bytecode for WITHDRAWALS_ENABLER_ROLE
			const WITHDRAWALS_ENABLER_ROLE =
				await lidoBridge.WITHDRAWALS_ENABLER_ROLE();

			const isDepositEnabled = await lidoBridge.isDepositsEnabled();
			const isWithdrawEnabled = await lidoBridge.isWithdrawalsEnabled();

			if (!isDepositEnabled) {
				const isDeployerDepEnabler = await lidoBridge.hasRole(
					DEPOSITS_ENABLER_ROLE,
					deployWallet.address,
					{
						gasPrice,
						gasLimit: 10_000_000,
					}
				);

				if (!isDeployerDepEnabler) {
					await lidoBridge.grantRole(
						DEPOSITS_ENABLER_ROLE,
						deployWallet.address,
						{
							gasPrice,
							gasLimit: 10_000_000,
						}
					);
				}

				await lidoBridge.enableDeposits({
					gasPrice,
					gasLimit: 10_000_000,
				});
				console.log('DEPOSITS ON L1 ENABLED');
			} else {
				console.log('DEPOSITS ON L1 ALREADY ENABLED');
			}

			if (!isWithdrawEnabled) {
				const isDeployerWithEnabler = await lidoBridge.hasRole(
					WITHDRAWALS_ENABLER_ROLE,
					deployWallet.address,
					{
						gasPrice,
						gasLimit: 10_000_000,
					}
				);

				if (!isDeployerWithEnabler) {
					await lidoBridge.grantRole(
						WITHDRAWALS_ENABLER_ROLE,
						deployWallet.address,
						{
							gasPrice,
							gasLimit: 10_000_000,
						}
					);
				}

				await lidoBridge.enableWithdrawals({
					gasPrice,
					gasLimit: 10_000_000,
				});
				console.log('WITHDRAWS ON L1 ENABLED');
			} else {
				console.log('WITHDRAWS ON L1 ALREADY ENABLED');
			}

			// L2 zkSync

			const l2Bridge = new Contract(
				deployer.addresses.Bridges.LidoL2BridgeProxy,
				L2ERC20Bridge.abi,
				zkWallet
			);

			const isDepositEnabledOnL2 = await l2Bridge.isDepositsEnabled();
			const isWithdrawEnabledOnL2 = await l2Bridge.isWithdrawalsEnabled();

			const gasPriceL2 = await zkProvider.getGasPrice();

			const isL2ManagerInitialized = await l2Bridge.isInitialized();

			if (!isL2ManagerInitialized) {
				await l2Bridge['initialize(address)'](deployWallet.address, {
					gasPrice: gasPriceL2,
					gasLimit: 10_000_000,
				});
			}

			if (!isDepositEnabledOnL2) {
				const isDeployerDepEnabler = await l2Bridge.hasRole(
					DEPOSITS_ENABLER_ROLE,
					deployWallet.address,
					{
						gasPrice: gasPriceL2,
						gasLimit: 10_000_000,
					}
				);

				if (!isDeployerDepEnabler) {
					await l2Bridge.grantRole(
						DEPOSITS_ENABLER_ROLE,
						deployWallet.address,
						{
							gasPrice: gasPriceL2,
							gasLimit: 10_000_000,
						}
					);
				}

				await l2Bridge.enableDeposits();
				console.log('DEPOSITS ON L2 ENABLED');
			} else {
				console.log('DEPOSITS ON L2 ALREADY ENABLED');
			}

			if (!isWithdrawEnabledOnL2) {
				const isDeployerWithEnabler = await l2Bridge.hasRole(
					WITHDRAWALS_ENABLER_ROLE,
					deployWallet.address,
					{
						gasPrice: gasPriceL2,
						gasLimit: 10_000_000,
					}
				);

				if (!isDeployerWithEnabler) {
					await l2Bridge.grantRole(
						WITHDRAWALS_ENABLER_ROLE,
						deployWallet.address,
						{
							gasPrice: gasPriceL2,
							gasLimit: 10_000_000,
						}
					);
				}

				await l2Bridge.enableWithdrawals({
					gasPrice: gasPriceL2,
					gasLimit: 10_000_000,
				});
				console.log('WITHDRAWS ON L2 ENABLED');
			} else {
				console.log('WITHDRAWS ON L2 ALREADY ENABLED');
			}

			console.log('==================L1=================');

			console.log('DEPOSIT STATUS', await lidoBridge.isDepositsEnabled());
			console.log('WITHDRAWAL STATUS', await lidoBridge.isWithdrawalsEnabled());

			console.log('==================L2=================');

			console.log('DEPOSIT STATUS', await l2Bridge.isDepositsEnabled());
			console.log('WITHDRAWAL STATUS', await l2Bridge.isWithdrawalsEnabled());
		});

	await program.parseAsync(process.argv);
}

main().catch((error) => {
	throw error;
});
