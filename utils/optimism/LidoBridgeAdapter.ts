import { StandardBridgeAdapter, toAddress } from "@eth-optimism/sdk";
import { hexStringEquals } from "@eth-optimism/core-utils";
import { Contract } from 'ethers';

export class LidoBridgeAdapter extends StandardBridgeAdapter {
    async supportsTokenPair(l1Token: Contract, l2Token: Contract) {
        const l1Bridge = new Contract(this.l1Bridge.address, [
            {
                inputs: [],
                name: 'L1_TOKEN_NON_REBASABLE',
                outputs: [
                    {
                        internalType: 'address',
                        name: '',
                        type: 'address',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            {
                inputs: [],
                name: 'L2_TOKEN_NON_REBASABLE',
                outputs: [
                    {
                        internalType: 'address',
                        name: '',
                        type: 'address',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
        ], this.messenger.l1Provider);
        const allowedL1Token = await l1Bridge.L1_TOKEN_NON_REBASABLE();
        if (!(0, hexStringEquals)(allowedL1Token, (0, toAddress)(l1Token))) {
            return false;
        }
        const allowedL2Token = await l1Bridge.L2_TOKEN_NON_REBASABLE();
        if (!(0, hexStringEquals)(allowedL2Token, (0, toAddress)(l2Token))) {
            return false;
        }
        return true;
    }
}
