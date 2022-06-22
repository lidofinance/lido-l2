import { providers } from "ethers";
import hre from "hardhat";

type CtxFactory<T> = () => Promise<T>;

type CtxFn<T> = (ctx: T) => Promise<void>;

interface StepTest<T> {
  title: string;
  test: CtxFn<T>;
}

class ScenarioTest<T> {
  private afterFn?: CtxFn<T>;
  private beforeFn?: CtxFn<T>;

  private readonly title: string;
  private readonly ctxFactory: CtxFactory<T>;
  private readonly steps: StepTest<T>[] = [];

  constructor(title: string, ctxFactory: CtxFactory<T>) {
    this.title = title;
    this.ctxFactory = ctxFactory;
  }

  after(fn: CtxFn<T>) {
    this.afterFn = fn;
    return this;
  }

  before(fn: CtxFn<T>) {
    this.beforeFn = fn;
    return this;
  }

  step(title: string, test: CtxFn<T>) {
    this.steps.push({ title, test });
    return this;
  }

  run() {
    const self = this;
    const { beforeFn, afterFn } = this;
    describe(this.title, function () {
      // @ts-ignore
      let ctx: T = {};
      before(async () => {
        ctx = Object.assign(ctx, await self.ctxFactory());
        if (beforeFn) {
          await beforeFn(ctx);
        }
      });

      let skipOtherTests = false;
      for (let i = 0; i < self.steps.length; ++i) {
        const step = self.steps[i];
        const stepTitle = `${i + 1}/${self.steps.length} ${step.title}`;

        it(stepTitle, async function () {
          if (skipOtherTests) {
            this.skip();
          }
          try {
            await step.test(ctx);
          } catch (error) {
            skipOtherTests = true;
            throw error;
          }
        });
      }

      if (afterFn !== undefined) {
        after(async () => afterFn(ctx));
      }
    });
  }
}

class UnitTest<T> {
  public readonly title: string;

  private readonly ctxFactory: CtxFactory<T>;
  private readonly tests: StepTest<T>[] = [];

  constructor(title: string, ctxFactory: CtxFactory<T>) {
    this.title = title;
    this.ctxFactory = ctxFactory;
  }

  group<K>(group: K[], testFactory: (item: K) => [string, CtxFn<T>]) {
    const tests = group.map(testFactory);
    for (const [title, test] of tests) {
      this.tests.push({ title, test });
    }
    return this;
  }

  test(title: string, test: CtxFn<T>) {
    this.tests.push({ title, test });
    return this;
  }

  run() {
    const { title, tests, ctxFactory } = this;

    describe(title, function () {
      // @ts-ignore
      let ctx: T = {};

      let evmSnapshotId: string;

      // prepare unit tests
      before(async () => {
        ctx = Object.assign(ctx, await ctxFactory());
        evmSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      // create mocha tests
      for (const { title, test } of tests) {
        it(title, () => test(ctx));
      }

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [evmSnapshotId]);
        evmSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });
    });
  }
}

export function scenario<T>(title: string, ctxFactory: CtxFactory<T>) {
  return new ScenarioTest(title, ctxFactory);
}

export function unit<T>(title: string, ctxFactory: CtxFactory<T>) {
  return new UnitTest(title, ctxFactory);
}

function accessControlRevertMessage(role: string, address: string) {
  return `AccessControl: account ${address.toLowerCase()} is missing role ${role}`;
}

async function impersonate(
  address: string,
  provider?: providers.JsonRpcProvider
) {
  provider ||= hre.ethers.provider;

  await provider.send("hardhat_impersonateAccount", [address]);
  return provider.getSigner(address);
}

export default {
  impersonate,
  accessControlRevertMessage,
};
