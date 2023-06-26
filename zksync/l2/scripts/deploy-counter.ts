import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet } from 'zksync-web3';
import * as hre from 'hardhat';

const DEPLOYER_WALLET_PRIVATE_KEY = process.env.DEPLOYER_WALLET_PRIVATE_KEY || '';
const COUNTER_CONTRACT_NAME = 'Counter';
const GOVERNOR_ADDR = '0xCD1D61957236565679b27e14d7c7A5198b052edb';

async function main() {
    console.info('Deploying ' + COUNTER_CONTRACT_NAME + '...');

    const zkWallet = new Wallet(DEPLOYER_WALLET_PRIVATE_KEY);
    const deployer = new Deployer(hre, zkWallet);

    const artifact = await deployer.loadArtifact(COUNTER_CONTRACT_NAME);

    const contract = await deployer.deploy(artifact, [GOVERNOR_ADDR]);

    console.info(`Counter was deployed to ${contract.address}`);
}

main().catch((error) => {
    throw error;
});
