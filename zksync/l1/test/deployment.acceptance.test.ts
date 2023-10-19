import * as hre from "hardhat";
import { scenario } from "../../../utils/testing";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet, ethers } from "ethers";
import { Provider, Wallet as ZkWallet, utils } from "zksync-web3";
import { assert } from "chai";
import { L1ERC20Bridge__factory, L1Executor__factory } from "../typechain";
import {
  ERC20BridgedUpgradeable__factory,
  L2ERC20Bridge__factory,
  ProxyAdmin__factory,
  ZkSyncBridgeExecutor__factory,
} from "../../l2/typechain";

import { ZKSYNC_ADDRESSES } from "./e2e/e2e";
import { IZkSyncFactory } from "zksync-web3/build/typechain";
import { OssifiableProxy__factory } from "../typechain";
import { TransparentUpgradeableProxy__factory } from "../../l2/typechain";
import { HASHES } from "../scripts/utils/hashes";

import {
  ERC20_BRIDGED_CONSTANTS,
  GOVERNANCE_CONSTANTS,
} from "../../l2/scripts/utils/constants";
import { defaultAbiCoder } from "ethers/lib/utils";

const ETH_CLIENT_WEB3_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;
const CONTRACTS_DIAMOND_PROXY_ADDR = process.env
  .CONTRACTS_DIAMOND_PROXY_ADDR as string;

scenario("Lido on zkSync Era :: deployment acceptance test", ctxFactory)
  .step("L1 Bridge :: proxy admin", async (ctx) => {
    const {
      l1: { proxy },
    } = ctx;
    assert.equal(
      await proxy.l1Bridge.proxy__getAdmin(),
      ZKSYNC_ADDRESSES.l1.agent
    );
  })

  .step("L1 Bridge :: bridge admin", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;
    assert.isTrue(
      await l1Bridge.hasRole(
        HASHES.ROLES.DEFAULT_ADMIN_ROLE,
        ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig
      )
    );
  })

  .step("L1 Bridge :: L1 Token", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    assert.equal(await l1Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
  })

  .step("L1 Bridge :: L2 Token", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    assert.equal(await l1Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
  })

  .step("L1 Bridge :: L2 Bridge", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    assert.equal(await l1Bridge.l2Bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
  })

  .step("L1 Bridge :: is deposits disabled", async (ctx) => {
    const {
      l1: { l1Bridge },
      depositsEnabled,
    } = ctx;

    assert.equal(await l1Bridge.isDepositsEnabled(), depositsEnabled.l1);
  })

  .step("L1 Bridge :: is withdrawals enabled", async (ctx) => {
    const {
      l1: { l1Bridge },
      withdrawalsEnabled,
    } = ctx;

    assert.equal(await l1Bridge.isWithdrawalsEnabled(), withdrawalsEnabled.l1);
  })

  .step("L1 Bridge :: deposit enablers", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    const enablerAddresses = [
      ZKSYNC_ADDRESSES.l1.agent,
      ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
    ];

    for (const enabler of enablerAddresses) {
      assert.isTrue(
        await l1Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
      );
    }
  })

  .step("L1 Bridge :: deposit disablers", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    const disablerAddresses = [
      ZKSYNC_ADDRESSES.l1.agent,
      ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
    ];

    for (const disabler of disablerAddresses) {
      assert.isTrue(
        await l1Bridge.hasRole(HASHES.ROLES.DEPOSITS_DISABLER_ROLE, disabler)
      );
    }
  })
  .step("L1 Bridge :: withdrawal enablers", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    const enablerAddresses = [ZKSYNC_ADDRESSES.l1.agent];

    for (const enabler of enablerAddresses) {
      assert.isTrue(
        await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE, enabler)
      );
    }
  })

  .step("L1 Bridge :: withdrawal disablers", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    const disablerAddresses = [
      ZKSYNC_ADDRESSES.l1.agent,
      ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
    ];

    for (const disabler of disablerAddresses) {
      assert.isTrue(
        await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE, disabler)
      );
    }
  })

  .step("L1 Executor :: proxy admin", async (ctx) => {
    const {
      l1: {
        proxy: { l1Executor },
      },
    } = ctx;

    assert.equal(await l1Executor.proxy__getAdmin(), ZKSYNC_ADDRESSES.l1.agent);
  })

  .step("L1 Executor :: owner", async (ctx) => {
    const {
      l1: { l1Executor },
    } = ctx;

    assert.equal(await l1Executor.owner(), ZKSYNC_ADDRESSES.l1.agent);
  })

  /**
   *
   * L2
   *
   */

  .step("L2 Bridge :: proxy admin", async (ctx) => {
    const {
      l2: { proxy },
    } = ctx;
    assert.equal(
      await proxy.l2Bridge.proxy__getAdmin(),
      ZKSYNC_ADDRESSES.l2.govExecutor
    );
  })

  .step("L2 Bridge :: bridge admin", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;
    assert.isTrue(
      await l2Bridge.hasRole(
        HASHES.ROLES.DEFAULT_ADMIN_ROLE,
        ZKSYNC_ADDRESSES.l2.govExecutor
      )
    );
  })

  .step("L2 Bridge :: L1 Token", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    assert.equal(await l2Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
  })

  .step("L2 Bridge :: L2 Token", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    assert.equal(await l2Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
  })

  .step("L2 Bridge :: L1 Bridge", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    assert.equal(await l2Bridge.l1Bridge(), ZKSYNC_ADDRESSES.l1.l1Bridge);
  })

  .step("L2 Bridge :: is deposits disabled", async (ctx) => {
    const {
      l2: { l2Bridge },
      depositsEnabled,
    } = ctx;

    assert.equal(await l2Bridge.isDepositsEnabled(), depositsEnabled.l2);
  })

  .step("L2 Bridge :: is withdrawals enabled", async (ctx) => {
    const {
      l2: { l2Bridge },
      withdrawalsEnabled,
    } = ctx;

    assert.equal(await l2Bridge.isWithdrawalsEnabled(), withdrawalsEnabled.l2);
  })

  .step("L2 Bridge :: deposit enablers", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    const enablerAddresses = [ZKSYNC_ADDRESSES.l2.govExecutor];

    for (const enabler of enablerAddresses) {
      assert.isTrue(
        await l2Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
      );
    }
  })

  .step("L2 Bridge :: deposit disablers", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    const disablerAddresses = [
      ZKSYNC_ADDRESSES.l2.govExecutor,
      ZKSYNC_ADDRESSES.l2.emergencyBrakeMultisig,
    ];

    for (const disabler of disablerAddresses) {
      assert.isTrue(
        await l2Bridge.hasRole(HASHES.ROLES.DEPOSITS_DISABLER_ROLE, disabler)
      );
    }
  })
  .step("L2 Bridge :: withdrawal enablers", async (ctx) => {
    const {
      l1: { l1Bridge },
    } = ctx;

    const enablerAddresses = [ZKSYNC_ADDRESSES.l1.agent];

    for (const enabler of enablerAddresses) {
      assert.isTrue(
        await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE, enabler)
      );
    }
  })

  .step("L2 Bridge :: withdrawal disablers", async (ctx) => {
    const {
      l2: { l2Bridge },
    } = ctx;

    const disablerAddresses = [
      ZKSYNC_ADDRESSES.l2.govExecutor,
      ZKSYNC_ADDRESSES.l2.emergencyBrakeMultisig,
    ];

    for (const disabler of disablerAddresses) {
      assert.isTrue(
        await l2Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE, disabler)
      );
    }
  })

  .step("L2 Token :: proxy admin", async (ctx) => {
    const {
      l2: {
        accounts: { deployer },
      },
      zkProvider,
    } = ctx;

    const proxyAdminAddressBytes32 = await zkProvider.getStorageAt(
      ZKSYNC_ADDRESSES.l2.l2Token,
      "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" // storage where admin address is stored
    ); // returns bytes32

    const proxyAdminAddress = defaultAbiCoder.decode(
      ["address"],
      proxyAdminAddressBytes32
    ); // returns Result => []

    const proxyAdminContract = ProxyAdmin__factory.connect(
      proxyAdminAddress[0], // proxyAdminAddress 0 index is the location of address
      deployer
    );

    const L2TokenProxyAdminOwner = await proxyAdminContract.owner();

    assert.equal(
      L2TokenProxyAdminOwner,
      ethers.utils.getAddress(
        utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
      )
    );
  })

  .step("L2 Token :: name", async (ctx) => {
    assert.equal(await ctx.l2.l2Token.name(), ERC20_BRIDGED_CONSTANTS.NAME);
  })
  .step("L2 Token :: symbol", async (ctx) => {
    assert.equal(await ctx.l2.l2Token.symbol(), ERC20_BRIDGED_CONSTANTS.SYMBOL);
  })
  .step("L2 Token :: decimals", async (ctx) => {
    assert.equal(
      await ctx.l2.l2Token.decimals(),
      ERC20_BRIDGED_CONSTANTS.DECIMALS
    );
  })
  .step("L2 Token :: total supply", async (ctx) => {
    assert.equal(
      +ethers.utils.formatEther(await ctx.l2.l2Token.totalSupply()),
      0
    );
  })

  .step("L2 token :: bridge", async (ctx) => {
    assert.equal(await ctx.l2.l2Token.bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
  })

  .step("L2 Governance Executor :: proxy admin", async (ctx) => {
    const {
      l2: {
        accounts: { deployer },
      },
      zkProvider,
    } = ctx;

    const proxyAdminAddressBytes32 = await zkProvider.getStorageAt(
      ZKSYNC_ADDRESSES.l2.govExecutor,
      "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
    ); // returns bytes32

    const proxyAdminAddress = defaultAbiCoder.decode(
      ["address"],
      proxyAdminAddressBytes32
    ); // returns Result => []

    const proxyAdminContract = ProxyAdmin__factory.connect(
      proxyAdminAddress[0], // proxyAdminAddress 0 index is the location of address
      deployer
    );

    const L2TokenProxyAdminOwner = await proxyAdminContract.owner();

    assert.equal(
      L2TokenProxyAdminOwner,
      ethers.utils.getAddress(
        utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
      )
    );
  })

  .step("L2 Governance Executor :: executor address", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;

    assert.equal(
      await govExecutor.getEthereumGovernanceExecutor(),
      ethers.utils.getAddress(
        utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
      )
    );
  })

  .step("L2 Governance Executor :: delay", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;

    assert.equal(
      (await govExecutor.getDelay()).toString(),
      GOVERNANCE_CONSTANTS.DELAY
    );
  })

  .step("L2 Governance Executor :: grace period", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;
    assert.equal(
      (await govExecutor.getGracePeriod()).toString(),
      GOVERNANCE_CONSTANTS.GRACE_PERIOD
    );
  })
  .step("L2 Governance Executor :: min delay", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;
    assert.equal(
      (await govExecutor.getMinimumDelay()).toString(),
      GOVERNANCE_CONSTANTS.MIN_DELAY
    );
  })
  .step("L2 Governance Executor :: max delay", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;
    assert.equal(
      (await govExecutor.getMaximumDelay()).toString(),
      GOVERNANCE_CONSTANTS.MAX_DELAY
    );
  })
  .step("L2 Governance Executor :: guardian", async (ctx) => {
    const {
      l2: { govExecutor },
    } = ctx;
    assert.equal(
      (await govExecutor.getGuardian()).toString(),
      ZKSYNC_ADDRESSES.l2.guardian
    );
  })

  .run();

async function ctxFactory() {
  const { l1, l2 } = ZKSYNC_ADDRESSES;

  const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);
  const ethProvider = new JsonRpcProvider(ETH_CLIENT_WEB3_URL);

  const ethDeployer = new Wallet(
    process.env.PRIVATE_KEY as string,
    ethProvider
  );

  const deployer = new ZkWallet(process.env.PRIVATE_KEY as string, zkProvider);

  return {
    l1: {
      proxy: {
        l1Bridge: new OssifiableProxy__factory(ethDeployer).attach(l1.l1Bridge),
        l1Executor: new OssifiableProxy__factory(ethDeployer).attach(
          l1.l1Executor
        ),
      },
      l1Bridge: new L1ERC20Bridge__factory(ethDeployer).attach(l1.l1Bridge),
      l1Executor: new L1Executor__factory(ethDeployer).attach(l1.l1Executor),
      zkSync: IZkSyncFactory.connect(CONTRACTS_DIAMOND_PROXY_ADDR, ethDeployer),
      accounts: {
        deployer: ethDeployer,
      },
    },
    l2: {
      proxy: {
        l2Token: new TransparentUpgradeableProxy__factory(deployer).attach(
          l2.l2Token
        ),
        l2Bridge: new OssifiableProxy__factory(deployer).attach(l2.l2Bridge),
        govExecutor: new TransparentUpgradeableProxy__factory(deployer).attach(
          l2.govExecutor
        ),
      },
      // CONTRACTS
      l2Token: new ERC20BridgedUpgradeable__factory(deployer).attach(
        l2.l2Token
      ),
      l2Bridge: new L2ERC20Bridge__factory(deployer).attach(l2.l2Bridge),
      govExecutor: new ZkSyncBridgeExecutor__factory(deployer).attach(
        l2.govExecutor
      ),
      accounts: {
        deployer,
      },
    },
    depositsEnabled: {
      l1: false,
      l2: true,
    },
    withdrawalsEnabled: {
      l1: true,
      l2: true,
    },
    zkProvider,
    ethProvider,
  };
}
