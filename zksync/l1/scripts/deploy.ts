/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
	ethers as eth,
	BigNumberish,
	BytesLike,
	Signer,
	Wallet,
	providers,
} from 'ethers';
import { getAddressFromEnv } from './utils/utils';
import { IZkSyncFactory } from 'zksync-web3/build/typechain';
import { SingletonFactory__factory } from '../typechain/factories/l1/contracts/SingletonFactory__factory';
import { L1ERC20Bridge__factory } from '../typechain/factories/l1/contracts/L1ERC20Bridge__factory';
import { AragonAgentMock__factory } from '../typechain/factories/l1/contracts/governance/AragonAgentMock__factory';

export interface DeployedAddresses {
	ZkSync: {
		MailboxFacet: string;
		GovernanceFacet: string;
		ExecutorFacet: string;
		DiamondCutFacet: string;
		GettersFacet: string;
		Verifier: string;
		DiamondInit: string;
		DiamondUpgradeInit: string;
		DiamondProxy: string;
	};
	Bridges: {
		LidoBridgeImplementation: string;
		LidoBridgeProxy: string;
		LidoL2BridgeProxy: string;
	};
	AllowList: string;
	Create2Factory: string;
	LidoTokenL1: string;
	LidoTokenL2: string;
	GovernanceL1: string;
	ZkGovernanceExecutor: string;
}

export interface DeployerConfig {
	deployWallet: Wallet;
	governorAddress?: string;
	verbose?: boolean;
}

export function deployedAddressesFromEnv(): DeployedAddresses {
	return {
		ZkSync: {
			MailboxFacet: getAddressFromEnv('CONTRACTS_MAILBOX_FACET_ADDR'),
			GovernanceFacet: getAddressFromEnv('CONTRACTS_GOVERNANCE_FACET_ADDR'),
			DiamondCutFacet: getAddressFromEnv('CONTRACTS_DIAMOND_CUT_FACET_ADDR'),
			ExecutorFacet: getAddressFromEnv('CONTRACTS_EXECUTOR_FACET_ADDR'),
			GettersFacet: getAddressFromEnv('CONTRACTS_GETTERS_FACET_ADDR'),
			DiamondInit: getAddressFromEnv('CONTRACTS_DIAMOND_INIT_ADDR'),
			DiamondUpgradeInit: getAddressFromEnv(
				'CONTRACTS_DIAMOND_UPGRADE_INIT_ADDR'
			),
			DiamondProxy: getAddressFromEnv('CONTRACTS_DIAMOND_PROXY_ADDR'),
			Verifier: getAddressFromEnv('CONTRACTS_VERIFIER_ADDR'),
		},
		Bridges: {
			LidoBridgeImplementation: getAddressFromEnv(
				'CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR'
			),
			LidoBridgeProxy: getAddressFromEnv('CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR'),
			LidoL2BridgeProxy: getAddressFromEnv(
				'CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR'
			),
		},
		AllowList: getAddressFromEnv('CONTRACTS_L1_ALLOW_LIST_ADDR'),
		Create2Factory: getAddressFromEnv('CONTRACTS_CREATE2_FACTORY_ADDR'),
		LidoTokenL1: getAddressFromEnv('CONTRACTS_L1_LIDO_TOKEN_ADDR'),
		LidoTokenL2: getAddressFromEnv('CONTRACTS_L2_LIDO_TOKEN_ADDR'),
		GovernanceL1: getAddressFromEnv('CONTRACTS_L1_GOVERNANCE_AGENT_ADDR'),
		ZkGovernanceExecutor: getAddressFromEnv('L2_BRIDGE_EXECUTOR_ADDR'),
	};
}

export class Deployer {
	public addresses: DeployedAddresses;
	private deployWallet: Wallet;
	private verbose: boolean;
	private governorAddress: string;

	constructor(config: DeployerConfig) {
		this.deployWallet = config.deployWallet;
		this.verbose = config.verbose != null ? config.verbose : false;
		this.addresses = deployedAddressesFromEnv();
		this.governorAddress =
			config.governorAddress != null
				? config.governorAddress
				: this.deployWallet.address;
	}

	public async deployCreate2Factory(
		ethTxOptions?: eth.providers.TransactionRequest
	) {
		if (this.verbose) {
			console.log('Deploying Create2 factory');
		}

		const contractFactory = await ethers.getContractFactory(
			'SingletonFactory',
			{
				signer: this.deployWallet,
			}
		);

		const create2Factory = await contractFactory.deploy(...[ethTxOptions]);
		const rec = await create2Factory.deployTransaction.wait();

		if (this.verbose) {
			console.log(`CONTRACTS_CREATE2_FACTORY_ADDR=${create2Factory.address}`);
			console.log(
				`Create2 factory deployed, gasUsed: ${rec.gasUsed.toString()}`
			);
		}

		this.addresses.Create2Factory = create2Factory.address;
	}

	private async deployViaCreate2(
		contractName: string,
		args: any[],
		create2Salt: string,
		ethTxOptions: eth.providers.TransactionRequest,
		libraries?: any
	) {
		if (this.verbose) {
			console.log(`Deploying ${contractName}`);
		}

		const create2Factory = await this.create2FactoryContract(this.deployWallet);
		const contractFactory = await ethers.getContractFactory(contractName, {
			signer: this.deployWallet,
			libraries,
		});
		const bytecode = contractFactory.getDeployTransaction(
			...[...args, ethTxOptions]
		).data as BytesLike;

		const expectedAddress = ethers.utils.getCreate2Address(
			create2Factory.address,
			create2Salt,
			ethers.utils.keccak256(bytecode)
		);

		const deployedBytecodeBefore = await this.deployWallet.provider.getCode(
			expectedAddress
		);
		if (ethers.utils.hexDataLength(deployedBytecodeBefore) > 0) {
			if (this.verbose) {
				console.log(`Contract ${contractName} already deployed!`);
			}
			return;
		}

		const tx = await create2Factory.deploy(bytecode, create2Salt, ethTxOptions);
		const receipt = await tx.wait();

		if (this.verbose) {
			const gasUsed = receipt.gasUsed;

			console.log(`${contractName} deployed, gasUsed: ${gasUsed.toString()}`);
		}

		const deployedBytecodeAfter = await this.deployWallet.provider.getCode(
			expectedAddress
		);
		// eslint-disable-next-line eqeqeq
		if (ethers.utils.hexDataLength(deployedBytecodeAfter) == 0) {
			throw new Error('Failed to deploy bytecode via create2 factory');
		}

		return expectedAddress;
	}

	public async deployLidoBridgeContracts(
		create2Salt: string,
		gasPrice?: BigNumberish,
		nonce?: number
	) {
		nonce = nonce || (await this.deployWallet.getTransactionCount());

		if (process.env.CHAIN_ETH_NETWORK === 'localhost') {
			await this.deployLidoL1Token(create2Salt, { gasPrice, nonce: nonce++ });
		}

		await this.deployLidoBridgeImplementation(create2Salt, {
			gasPrice,
			nonce: nonce++,
		});
		await this.deployLidoBridgeProxy(create2Salt, { gasPrice, nonce: nonce++ });
	}

	private async deployLidoL1Token(
		create2Salt: string,
		ethTxOptions: eth.providers.TransactionRequest
	) {
		ethTxOptions.gasLimit ??= 10_000_000;
		const contractAddress = await this.deployViaCreate2(
			'ERC20Token',
			['ERC20Token', 'wstETH', 18],
			create2Salt,
			ethTxOptions
		);

		if (this.verbose) {
			console.log(`CONTRACTS_L1_LIDO_TOKEN_ADDR=${contractAddress}`);
		}

		this.addresses.LidoTokenL1 = contractAddress!;
	}

	private async deployLidoBridgeImplementation(
		create2Salt: string,
		ethTxOptions: eth.providers.TransactionRequest
	) {
		ethTxOptions.gasLimit ??= 10_000_000;
		const contractAddress = await this.deployViaCreate2(
			'L1ERC20Bridge',
			[this.addresses.ZkSync.DiamondProxy],
			create2Salt,
			ethTxOptions
		);

		if (this.verbose) {
			console.log(`CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR=${contractAddress}`);
		}

		this.addresses.Bridges.LidoBridgeImplementation = contractAddress!;
	}

	public async deployLidoBridgeProxy(
		create2Salt: string,
		ethTxOptions: eth.providers.TransactionRequest
	) {
		ethTxOptions.gasLimit ??= 10_000_000;
		const contractAddress = await this.deployViaCreate2(
			'OssifiableProxy',
			[
				this.addresses.Bridges.LidoBridgeImplementation,
				this.governorAddress,
				'0x',
			],
			create2Salt,
			ethTxOptions
		);

		if (this.verbose) {
			console.log(`CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR=${contractAddress}`);
		}

		this.addresses.Bridges.LidoBridgeProxy = contractAddress!;
	}

	public async deployGovernanceAgent(
		create2Salt: string,
		ethTxOptions: eth.providers.TransactionRequest
	) {
		ethTxOptions.gasLimit ??= 10_000_000;
		const contractAddress = await this.deployViaCreate2(
			'AragonAgentMock',
			[],
			create2Salt,
			ethTxOptions
		);

		if (this.verbose) {
			console.log(`CONTRACTS_L1_GOVERNANCE_AGENT_ADDR=${contractAddress}`);
		}

		this.addresses.GovernanceL1 = contractAddress!;
	}

	public create2FactoryContract(signerOrProvider: Signer) {
		return new SingletonFactory__factory()
			.connect(signerOrProvider)
			.attach(this.addresses.Create2Factory);
	}

	public zkSyncContract(signerOrProvider: Signer | providers.Provider) {
		return IZkSyncFactory.connect(
			this.addresses.ZkSync.DiamondProxy,
			signerOrProvider
		);
	}

	public defaultLidoBridge(signerOrProvider: Signer | providers.Provider) {
		return L1ERC20Bridge__factory.connect(
			this.addresses.Bridges.LidoBridgeProxy,
			signerOrProvider
		);
	}

	public defaultGovernanceAgent(signerOrProvider: Signer) {
		return new AragonAgentMock__factory()
			.connect(signerOrProvider)
			.attach(this.addresses.GovernanceL1);
	}
}
