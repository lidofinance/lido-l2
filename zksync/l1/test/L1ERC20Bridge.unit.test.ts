import hre, { ethers } from 'hardhat';
import { wei } from '../../../utils/wei';
import { unit } from '../../../utils/testing';
import { assert } from 'chai';
import * as path from 'path';
import {
    L1ERC20Bridge__factory,
    ZkSyncStub__factory
} from '../typechain';
import {
    EmptyContractStub__factory,
    ERC20BridgedStub__factory,
    OssifiableProxy__factory,
} from '../../../typechain';
import { L2ERC20BridgeStub__factory } from '../../l2/typechain';
import { readBytecode } from '../scripts/utils';

// zksync/l2/artifacts-zk/l2/contracts
const l2Artifacts = path.join(
    path.resolve(__dirname, '../..', 'l2'),
    'artifacts-zk/l2/contracts'
);

const L2_LIDO_BRIDGE_PROXY_BYTECODE = readBytecode(
    path.join(l2Artifacts, 'proxy'),
    'OssifiableProxy'
);

const L2_LIDO_BRIDGE_STUB_BYTECODE = readBytecode(
    path.join(l2Artifacts, 'stubs'),
    'L2ERC20BridgeStub'
);

unit('ZkSync :: L1ERC20Bridge', ctxFactory)
    .test('zkSync()', async (ctx) => {
        assert.equal(
            await ctx.l1Erc20Bridge.zkSync(),
            ctx.stubs.zkSync.address
        );
    })

    .test('l1Token()', async (ctx) => {
        assert.equal(
            await ctx.l1Erc20Bridge.l1Token(),
            ctx.stubs.l1Token.address
        );
    })

    .test('l2Token()', async (ctx) => {
        assert.equal(
            await ctx.l1Erc20Bridge.l2Token(),
            ctx.stubs.l2Token.address
        );
    })

    .test('l2Bridge()', async (ctx) => {
        assert.equal(
            await ctx.l1Erc20Bridge.l2Bridge(),
            ctx.stubs.l2Erc20Bridge.address
        );
    })

    .test("l2TokenAddress() :: correct l1Token", async (ctx) => {
        const actualL2TokenAddress =
            await ctx.l1Erc20Bridge.l2TokenAddress(ctx.stubs.l1Token.address);

        assert.equal(actualL2TokenAddress, ctx.stubs.l2Token.address);
    })

    .test("l2TokenAddress() :: incorrect l1Token", async (ctx) => {
        const actualL2TokenAddress =
            await ctx.l1Erc20Bridge.l2TokenAddress(ctx.accounts.stranger.address);

        assert.equal(actualL2TokenAddress, ethers.constants.AddressZero);
    })

    .run();

async function ctxFactory() {
    const [deployer, governor, sender, recipient, stranger] = await hre.ethers.getSigners();

    const zkSyncStub = await new ZkSyncStub__factory(deployer).deploy();

    const l2TokenStub = await new EmptyContractStub__factory(deployer).deploy();
    const l1TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
        'ERC20 Mock',
        'ERC20'
    );
    await l1TokenStub.transfer(sender.address, wei`100 ether`);

    const l1Erc20BridgeImpl = await new L1ERC20Bridge__factory(deployer).deploy(zkSyncStub.address);

    const requiredValueToInitializeBridge = await zkSyncStub.l2TransactionBaseCost(0, 0, 0);

    const l1Erc20BridgeProxy = await new OssifiableProxy__factory(
        deployer
    ).deploy(l1Erc20BridgeImpl.address, governor.address, '0x');

    const l1Erc20Bridge = L1ERC20Bridge__factory.connect(
        l1Erc20BridgeProxy.address,
        deployer
    );

    const tx = await l1Erc20Bridge[
        'initialize(bytes[],address,address,address,uint256,uint256)'
    ](
        [
            L2_LIDO_BRIDGE_STUB_BYTECODE,
            L2_LIDO_BRIDGE_PROXY_BYTECODE,
        ],
        l1TokenStub.address,
        l2TokenStub.address,
        governor.address,
        requiredValueToInitializeBridge,
        requiredValueToInitializeBridge,
    );

    await tx.wait();

    return {
        accounts: {
            deployer,
            governor,
            sender,
            recipient,
            stranger
        },
        stubs: {
            zkSync: zkSyncStub,
            l1Token: l1TokenStub,
            l2Token: l2TokenStub,
            l2Erc20Bridge: L2ERC20BridgeStub__factory.connect(
                await l1Erc20Bridge.l2Bridge(),
                deployer
            )
        },
        l1Erc20Bridge
    }
}
