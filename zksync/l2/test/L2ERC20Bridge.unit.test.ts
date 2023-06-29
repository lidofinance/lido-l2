import hre from 'hardhat';
import { unit } from '../../../utils/testing';
import { assert } from 'chai';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { richWallet } from '../../l1/scripts/rich_wallet';

const TESTNET_PROVIDER_URL = 'http://localhost:3050';

unit('ZkSync :: L2ERC20Bridge', ctxFactory)
	.test('l1Bridge()', async (ctx) => {
		assert.equal(await ctx.l2Erc20Bridge.l1Bridge(), ctx.stubs.l1Bridge);
	})
	.test('l1Token()', async (ctx) => {
		assert.equal(await ctx.l2Erc20Bridge.l1Token(), ctx.stubs.l1Token);
	})
	.test('l2Token()', async (ctx) => {
		assert.equal(await ctx.l2Erc20Bridge.l2Token(), ctx.stubs.l2Token);
	})
	.run();

async function ctxFactory() {
	const provider = new Provider(TESTNET_PROVIDER_URL, 270);

	const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
	const governor = new Wallet(richWallet[1].privateKey, provider);
	const sender = new Wallet(richWallet[2].privateKey, provider);
	const recipient = new Wallet(richWallet[3].privateKey, provider);
	const stranger = new Wallet(richWallet[4].privateKey, provider);

	const deployer = new Deployer(hre, deployerWallet);

	// L2 Token
	const L2TokenArtifact = await deployer.loadArtifact(
		'ERC20BridgedUpgradeable'
	);
	const L2TokenContract = await hre.zkUpgrades.deployProxy(
		deployer.zkWallet,
		L2TokenArtifact,
		['wstEth', 'wstEth', 18],
		{ initializer: '__ERC20BridgedUpgradeable_init' }
	);

	const l2TokenProxy = await L2TokenContract.deployed();

	// L1 Token
	const emptyContractStubArtifact = await deployer.loadArtifact(
		'EmptyContractStub'
	);
	const l1TokenImplContract = await deployer.deploy(emptyContractStubArtifact);
	const l1Token = await l1TokenImplContract.deployed();

	const ossifiableProxyArtifact = await deployer.loadArtifact(
		'OssifiableProxy'
	);

	// L1 Bridge
	const l1BridgeContract = await deployer.deploy(emptyContractStubArtifact);
	const l1Bridge = await l1BridgeContract.deployed();

	// L2 Bridge
	const l2ERC20BridgeArtifact = await deployer.loadArtifact('L2ERC20Bridge');
	const l2Erc20BridgeImplContract = await deployer.deploy(
		l2ERC20BridgeArtifact,
		[]
	);
	const l2Erc20BridgeImpl = await l2Erc20BridgeImplContract.deployed();

	//proxy
	const l2Erc20BridgeProxyContract = await deployer.deploy(
		ossifiableProxyArtifact,
		[l2Erc20BridgeImpl.address, governor.address, '0x']
	);
	const l2Erc20BridgeProxy = await l2Erc20BridgeProxyContract.deployed();

	const l2Erc20Bridge = new Contract(
		l2Erc20BridgeProxy.address,
		l2ERC20BridgeArtifact.abi,
		deployer.zkWallet
	);

	const initTx = await l2Erc20Bridge['initialize(address,address,address)'](
		l1Bridge.address,
		l1Token.address,
		l2TokenProxy.address
	);

	await initTx.wait();

	return {
		accounts: {
			deployerWallet,
			governor,
			recipient,
			sender,
			stranger,
		},
		stubs: {
			l1Bridge: l1Bridge.address,
			l1Token: l1Token.address,
			l2Token: l2TokenProxy.address,
		},
		l2Erc20Bridge,
	};
}
