/* eslint-disable prettier/prettier */
import { ethers } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { Command } from 'commander';
import { web3Provider } from './utils';
import { richWallet } from './rich_wallet';

type Token = {
	address: string | null;
	name: string;
	symbol: string;
	decimals: number;
	implementation?: string;
};

const provider = web3Provider();
const wallet = new ethers.Wallet(richWallet[0].privateKey, provider);

const DEFAULT_TOKEN_IMPLEMENTATION = 'ERC20Token';

async function deployToken({
	address,
	name,
	symbol,
	decimals,
	implementation = DEFAULT_TOKEN_IMPLEMENTATION,
}: Token): Promise<Token> {
	const tokenFactory = await ethers.getContractFactory(implementation, wallet);
	const erc20 = await tokenFactory.deploy(name, symbol, decimals, {
		gasLimit: 5000000,
	});

	await erc20.deployed();

	await erc20.mint(wallet.address, ethers.utils.parseEther('3'), {
		gasLimit: 5000000,
	});

	address = erc20.address;

	return { address, name, symbol, decimals, implementation };
}

async function main() {
	const program = new Command();
	program
		.version('0.1.0')
		.name('deploy-erc20')
		.description('deploy erc20 token');

	program
		.option('-n, --token-name <tokenName>')
		.option('-s, --symbol <symbol>')
		.option('-d, --decimals <decimals>')
		.option('-i --implementation <implementation>')
		.action(async (cmd) => {
			const token: Token = {
				address: null,
				name: cmd.tokenName,
				symbol: cmd.symbol,
				decimals: cmd.decimals,
				implementation: cmd.implementation,
			};
			console.log(JSON.stringify(await deployToken(token), null, 2));
		});

	await program.parseAsync(process.argv);
}

// Resolve: Don't use process.exit(); throw an error instead
main().catch((err) => {
	throw new Error('Error:' + err);
});
