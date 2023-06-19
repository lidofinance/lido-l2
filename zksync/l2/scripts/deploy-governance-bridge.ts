import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet } from 'zksync-web3';
import * as hre from 'hardhat';

import { CONSTANTS, ADDRESSES } from './utils/governance-constants';

const DEPLOYER_WALLET_PRIVATE_KEY = process.env.DEPLOYER_WALLET_PRIVATE_KEY || '';

async function main() {
    const contractName = 'ZkSyncBridgeExecutorUpgradable';
    console.info('Deploying ' + contractName + '...');

    const zkWallet = new Wallet(DEPLOYER_WALLET_PRIVATE_KEY);
    const deployer = new Deployer(hre, zkWallet);

    const artifact = await deployer.loadArtifact(contractName);

    const contract = await hre.zkUpgrades.deployProxy(
        deployer.zkWallet,
        artifact,
        [
            ADDRESSES.ETHEREUM_GOVERNANCE_EXECUTOR,
            CONSTANTS.DELAY,
            CONSTANTS.GRACE_PERIOD,
            CONSTANTS.MIN_DELAY,
            CONSTANTS.MAX_DELAY,
            ADDRESSES.GUARDIAN
        ],
        { initializer: '__ZkSyncBridgeExecutor_init' }
    );

    await contract.deployed();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
