import * as dotenv from 'dotenv';

import { Wallet, Provider, utils, Contract } from 'zksync-web3';
import * as ethers from 'ethers';
import * as path from 'path';
import {
	getAddressFromEnv,
	web3Provider,
	zkSyncUrl,
	readInterface
} from '../utils/utils';
import { richWallet } from '../utils/rich_wallet';

dotenv.config();

const l1Artifacts = path.join(
	path.resolve(__dirname, '../..'),
	'artifacts/l1/contracts'
);

const l2Artifacts = path.join(
	path.resolve(__dirname, '../../..', 'l2'),
	'artifacts-zk/l2/contracts'
);

const L1_LIDO_BRIDGE_PROXY_ADDR = getAddressFromEnv('CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR');
const L1_LIDO_BRIDGE_PROXY_INTERFACE = readInterface(l1Artifacts, 'L1ERC20Bridge');
const L1_LIDO_TOKEN_ADDR = getAddressFromEnv('CONTRACTS_L1_LIDO_TOKEN_ADDR');
const L1_LIDO_TOKEN_INTERFACE = readInterface(path.join(l1Artifacts, 'token'), 'ERC20Token');

const L2_LIDO_TOKEN_ADDR = getAddressFromEnv('CONTRACTS_L2_LIDO_TOKEN_ADDR');
const L2_LIDO_TOKEN_INTERFACE = readInterface(path.join(l2Artifacts, 'token'), 'ERC20BridgedUpgradeable');

const AMOUNT_TO_DEPOSIT = ethers.utils.parseEther('10');

const {
	address: WALLET_ADDRESS,
	privateKey: WALLET_PRIVATE_KEY
} = richWallet[0];

const provider = web3Provider();
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
const zkProvider = new Provider(zkSyncUrl(), 270);
const zkWallet = new Wallet(WALLET_PRIVATE_KEY, zkProvider, provider);

async function main() {
	console.log('Running script to deposit ERC20 to zkSync');

	const l1TokenContract = new ethers.Contract(L1_LIDO_TOKEN_ADDR, L1_LIDO_TOKEN_INTERFACE, wallet);
	const l1BridgeContract = new ethers.Contract(L1_LIDO_BRIDGE_PROXY_ADDR, L1_LIDO_BRIDGE_PROXY_INTERFACE, wallet);
	const l2TokenContract = new Contract(L2_LIDO_TOKEN_ADDR, L2_LIDO_TOKEN_INTERFACE, zkWallet);

	// Mint tokens to L1 account
	const mintResponse = await l1TokenContract.mint(WALLET_ADDRESS, AMOUNT_TO_DEPOSIT);
	await mintResponse.wait();

	// Set allowance to L1 bridge
	const allowanceResponse = await l1TokenContract.approve(l1BridgeContract.address, AMOUNT_TO_DEPOSIT);
	await allowanceResponse.wait();
	console.log(`L1 Bridge allowance: ${await l1TokenContract.allowance(WALLET_ADDRESS, l1BridgeContract.address)}`);

	console.log('\n================== BEFORE DEPOSIT =================');
	console.log(`Account token balance on L1: ${await l1TokenContract.balanceOf(WALLET_ADDRESS)}`);
	console.log(`Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(l1BridgeContract.address)}`);
	console.log(`Account token balance on L2: ${await l2TokenContract.balanceOf(WALLET_ADDRESS)}`);

	const depositTx = await l1BridgeContract.populateTransaction[
		'deposit(address,address,uint256,uint256,uint256,address)'
	](
		WALLET_ADDRESS,
		l1TokenContract.address,
		AMOUNT_TO_DEPOSIT,
		ethers.BigNumber.from(10_000_000),
		utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
		WALLET_ADDRESS,
	);

	// call to RPC method zks_estimateGasL1ToL2 to estimate L2 gas limit
	const l2GasLimit = await zkProvider.estimateGasL1(depositTx);
	const l2GasPrice = await zkProvider.getGasPrice();

	const baseCost = await zkWallet.getBaseCost({
		gasLimit: l2GasLimit,
		gasPrice: l2GasPrice,
		gasPerPubdataByte: utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
	});

	const depositResponse = await l1BridgeContract[
		'deposit(address,address,uint256,uint256,uint256,address)'
	](
		WALLET_ADDRESS,
		l1TokenContract.address,
		AMOUNT_TO_DEPOSIT,
		l2GasLimit,
		utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
		WALLET_ADDRESS,
		{
			value: baseCost,
			gasLimit: 10_000_000
		}
	);
	await depositResponse.wait();

	const l2Response = await zkProvider.getL2TransactionFromPriorityOp(depositResponse);
	await l2Response.wait();

	console.log('\n================== AFTER DEPOSIT =================');
	console.log(`Account token balance on L1: ${await l1TokenContract.balanceOf(WALLET_ADDRESS)}`);
	console.log(`Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(l1BridgeContract.address)}`);
	console.log(`Account token balance on L2: ${await l2TokenContract.balanceOf(WALLET_ADDRESS)}`);
}

main().catch((err) => {
	throw err;
});
