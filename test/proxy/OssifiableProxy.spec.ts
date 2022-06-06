import { assert } from "chai";
import hre, { ethers } from "hardhat";
import {
  InitializableImplementationStub__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { testsuite } from "../../utils/testing";

testsuite("OssifiableProxy unit tests", ctxProvider, (ctx) => {
  it("proxy__getAdmin()", async () => {
    assert.equal(
      await ctx.ossifiableProxy.proxy__getAdmin(),
      ctx.accounts.admin.address
    );
  });

  it("proxy__getImplementation()", async () => {
    assert.equal(
      await ctx.ossifiableProxy.proxy__getImplementation(),
      ctx.implementations.current.address
    );
  });

  it("proxy__getIsOssified()", async () => {
    assert.isFalse(await ctx.ossifiableProxy.proxy__getIsOssified());
  });

  it("proxy__ossify() :: called by stranger", async () => {
    const {
      ossifiableProxy,
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__ossify(),
      "ErrorNotAdmin()"
    );
  });

  it("proxy__ossify() :: ossified", async () => {
    const { ossifiableProxy } = ctx;

    // ossify proxy
    await ossifiableProxy.proxy__ossify();

    // validate proxy is ossified
    assert.isTrue(await ossifiableProxy.proxy__getIsOssified());

    await assert.revertsWith(
      ossifiableProxy.proxy__ossify(),
      "ErrorProxyIsOssified()"
    );
  });

  it("proxy__ossify()", async () => {
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
  });

  it("proxy__changeAdmin() :: called by stranger", async () => {
    const {
      ossifiableProxy,
      accounts: { stranger },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__changeAdmin(stranger.address),
      "ErrorNotAdmin()"
    );
  });

  it("proxy__changeAdmin() :: ossified", async () => {
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
  });

  it("proxy__changeAdmin()", async () => {
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
  });

  it("proxy__upgradeTo() :: called by stranger", async () => {
    const {
      ossifiableProxy,
      accounts: { stranger },
      implementations: { next },
    } = ctx;

    await assert.revertsWith(
      ossifiableProxy.connect(stranger).proxy__upgradeTo(next.address),
      "ErrorNotAdmin()"
    );
  });

  it("proxy__upgradeTo() :: ossified", async () => {
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
  });

  it("proxy__upgradeTo()", async () => {
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
  });

  it("proxy__upgradeToAndCall() :: called by stranger", async () => {
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
  });

  it("proxy__upgradeToAndCall() :: ossified", async () => {
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
  });

  it("proxy__upgradeToAndCall() :: forceCall is false", async () => {
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
  });

  it("proxy__upgradeToAndCall() :: forceCall is true", async () => {
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
  });
});

async function ctxProvider() {
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
