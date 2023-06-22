import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet } from 'zksync-web3';
import * as hre from 'hardhat';

import { GOVERNANCE_CONSTANTS, ADDRESSES } from './utils/constants';

const DEPLOYER_WALLET_PRIVATE_KEY = process.env.DEPLOYER_WALLET_PRIVATE_KEY || '';
const BRIDGE_EXECUTOR_CONTRACT_NAME = 'ZkSyncBridgeExecutorUpgradable';

async function main() {
    console.info('Deploying ' + BRIDGE_EXECUTOR_CONTRACT_NAME + '...');

    const zkWallet = new Wallet(DEPLOYER_WALLET_PRIVATE_KEY);
    const deployer = new Deployer(hre, zkWallet);

    const artifact = await deployer.loadArtifact(BRIDGE_EXECUTOR_CONTRACT_NAME);

    const contract = await hre.zkUpgrades.deployProxy(
        deployer.zkWallet,
        artifact,
        [
            ADDRESSES.ETHEREUM_GOVERNANCE_EXECUTOR,
            GOVERNANCE_CONSTANTS.DELAY,
            GOVERNANCE_CONSTANTS.GRACE_PERIOD,
            GOVERNANCE_CONSTANTS.MIN_DELAY,
            GOVERNANCE_CONSTANTS.MAX_DELAY,
            ADDRESSES.GUARDIAN
        ],
        { initializer: '__ZkSyncBridgeExecutor_init' }
    );

    await contract.deployed();
}

main().catch((error) => {
    throw error;
});
