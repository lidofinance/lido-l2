import { Wallet, Provider, Contract, utils } from 'zksync-web3';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import * as hre from 'hardhat';

import { ADDRESSES } from './utils/constants';

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || '';
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL || '';

const ERC20_BRIDGED_TOKEN_CONTRACT_NAME = 'ERC20BridgedUpgradeable';
const ERC20_BRIDGED_TOKEN_CONTRACT_ADDRESS = '<L2_TOKEN_ADDRESS>';

function getToken(hre: HardhatRuntimeEnvironment, wallet: Wallet): Contract {
    const artifact = hre.artifacts.readArtifactSync(ERC20_BRIDGED_TOKEN_CONTRACT_NAME);
    return new Contract(ERC20_BRIDGED_TOKEN_CONTRACT_ADDRESS, artifact.abi, wallet);
}

async function main() {
    const provider = new Provider(ZKSYNC_PROVIDER_URL);
    const wallet = new Wallet(WALLET_PRIVATE_KEY, provider);

    const tokenContract = getToken(hre, wallet);

    const connectedBridgeAddress = await tokenContract.bridge();
    if (connectedBridgeAddress !== ADDRESSES.ZERO) {
        throw new Error('Token is already connected to the bridge');
    };

    const gasPrice = await provider.getGasPrice();

    await (
        await tokenContract.__ERC20BridgedUpgradeable_init_v2(ADDRESSES.L2_ERC20_BRIDGE, {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: 0,
            gasLimit: 10_000_000,
            customData: {
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            },
        })
    ).wait();

    console.log(`Connected bridge address that can mint/burn tokens: ${await tokenContract.bridge()}`);
}

main().catch((error) => {
    throw error;
});