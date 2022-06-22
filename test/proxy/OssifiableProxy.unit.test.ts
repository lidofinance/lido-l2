import { assert } from "chai";
import hre, { ethers } from "hardhat";
import {
  InitializableImplementationStub__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { unit } from "../../utils/testing";

unit("OssifiableProxy", ctxFactory)
  .test("proxy__getAdmin()", async (ctx) => {
    assert.equal(
      await ctx.ossifiableProxy.proxy__getAdmin(),
      ctx.accounts.admin.address
    );
  })

  .test("proxy__getImplementation()", async (ctx) => {
    assert.equal(
      await ctx.ossifiableProxy.proxy__getImplementation(),
      ctx.implementations.current.address
    );
  })

  .test("proxy__getIsOssified()", async (ctx) => {
    assert.isFalse(await ctx.ossifiableProxy.proxy__getIsOssified());
  })

  .test("proxy__ossify() :: called by stranger", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__ossify(),
      "ErrorNotAdmin()"
    );
  })

  .test("proxy__ossify() :: ossified", async (ctx) => {
    const { ossifiableProxy } = ctx;

    // ossify proxy
    await ossifiableProxy.proxy__ossify();

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());

    await assert.revertsWith(
      ossifiableProxy.proxy__ossify(),
      "ErrorProxyIsOssified()"
    );
  })

  .test("proxy__ossify()", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { admin },
    } = ctx;

    const tx = await ossifiableProxy.proxy__ossify();

    // validate AdminChanged event was emitted
    await assert.emits(ossifiableProxy, tx, "AdminChanged", [
      admin.address,
      ethers.constants.AddressZero,
    ]);

    // validate ProxyOssified event was emitted
    await assert.emits(ossifiableProxy, tx, "ProxyOssified");

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());
  })

  .test("proxy__changeAdmin() :: called by stranger", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__changeAdmin(stranger.address),
      "ErrorNotAdmin()"
    );
  })

  .test("proxy__changeAdmin() :: ossified", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { stranger },
    } = ctx;

    // ossify proxy
    await ossifiableProxy.proxy__ossify();

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());

    await assert.revertsWith(
      ossifiableProxy.proxy__changeAdmin(stranger.address),
      "ErrorProxyIsOssified()"
    );
  })

  .test("proxy__changeAdmin()", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { admin, stranger },
    } = ctx;

    const tx = await ossifiableProxy.proxy__changeAdmin(stranger.address);

    // validate AdminChanged event was emitted
    await assert.emits(ossifiableProxy, tx, "AdminChanged", [
      admin.address,
      stranger.address,
    ]);

    // validate admin was changed
    await assert.equal(
      await ossifiableProxy.proxy__getAdmin(),
      stranger.address
    );
  })

  .test("proxy__upgradeTo() :: called by stranger", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { stranger },
      implementations: { next },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__upgradeTo(next.address),
      "ErrorNotAdmin()"
    );
  })

  .test("proxy__upgradeTo() :: ossified", async (ctx) => {
    const {
      ossifiableProxy,
      implementations: { next },
    } = ctx;

    // ossify proxy
    await ossifiableProxy.proxy__ossify();

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());

    await assert.revertsWith(
      ossifiableProxy.proxy__upgradeTo(next.address),
      "ErrorProxyIsOssified()"
    );
  })

  .test("proxy__upgradeTo()", async (ctx) => {
    const {
      ossifiableProxy,
      implementations: { next },
    } = ctx;

    const tx = await ossifiableProxy.proxy__upgradeTo(next.address);

    // validate Upgraded event was emitted
    await assert.emits(ossifiableProxy, tx, "Upgraded", [next.address]);

    // validate implementation address was updated
    assert.equal(
      await ossifiableProxy.proxy__getImplementation(),
      next.address
    );
  })

  .test("proxy__upgradeToAndCall() :: called by stranger", async (ctx) => {
    const {
      ossifiableProxy,
      accounts: { stranger },
      implementations: { next },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy
        .connect(stranger)
        .proxy__upgradeToAndCall(
          next.address,
          next.interface.encodeFunctionData("initialize", [1]),
          false
        ),
      "ErrorNotAdmin()"
    );
  })

  .test("proxy__upgradeToAndCall() :: ossified", async (ctx) => {
    const {
      ossifiableProxy,
      implementations: { next },
    } = ctx;

    // ossify proxy
    await ossifiableProxy.proxy__ossify();

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());

    await assert.revertsWith(
      ossifiableProxy.proxy__upgradeToAndCall(
        next.address,
        next.interface.encodeFunctionData("initialize", [1]),
        false
      ),
      "ErrorProxyIsOssified()"
    );
  })

  .test("proxy__upgradeToAndCall() :: forceCall is false", async (ctx) => {
    const {
      ossifiableProxy,
      proxiedImplementation,
      implementations: { next },
    } = ctx;

    const tx = await ossifiableProxy.proxy__upgradeToAndCall(
      next.address,
      next.interface.encodeFunctionData("initialize", [1]),
      false
    );

    // validate Upgraded event was emitted
    await assert.emits(ossifiableProxy, tx, "Upgraded", [next.address]);

    // validate Initialized event was emitted
    await assert.emits(proxiedImplementation, tx, "Initialized", [1]);

    // validate implementation address was updated
    assert.equal(
      await ossifiableProxy.proxy__getImplementation(),
      next.address
    );

    // validate version was set
    assert.equal(await proxiedImplementation.version(), 1);
  })

  .test("proxy__upgradeToAndCall() :: forceCall is true", async (ctx) => {
    const {
      ossifiableProxy,
      implementations: { next },
      proxiedImplementation,
    } = ctx;

    const tx = await ossifiableProxy.proxy__upgradeToAndCall(
      next.address,
      "0x",
      true
    );

    // validate Upgraded event was emitted
    await assert.emits(ossifiableProxy, tx, "Upgraded", [next.address]);

    // validate FallbackIsFired event was emitted
    await assert.emits(proxiedImplementation, tx, "FallbackIsFired");

    // validate implementation address was updated
    assert.equal(
      await ossifiableProxy.proxy__getImplementation(),
      next.address
    );

    // validate version wasn't set
    assert.equal(await proxiedImplementation.version(), 0);
  })

  .run();

async function ctxFactory() {
  const [deployer, admin, stranger] = await hre.ethers.getSigners();

  const currentImpl = await new InitializableImplementationStub__factory(
    deployer
  ).deploy();
  const nextImpl = await new InitializableImplementationStub__factory(
    deployer
  ).deploy();

  const ossifiableProxy = await new OssifiableProxy__factory(deployer).deploy(
    currentImpl.address,
    admin.address,
    "0x"
  );

  return {
    accounts: { deployer, admin, stranger },
    implementations: {
      current: currentImpl,
      next: nextImpl,
    },
    ossifiableProxy: ossifiableProxy.connect(admin),
    proxiedImplementation: InitializableImplementationStub__factory.connect(
      ossifiableProxy.address,
      admin
    ),
  };
}
