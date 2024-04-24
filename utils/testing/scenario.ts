import { CtxFactory, StepTest, CtxFn } from "./types";

export class ScenarioTest<T extends object> {
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

  run(repeat: number = 1) {
    const self = this;
    const { beforeFn, afterFn } = this;
    for (let i = 0; i < repeat; i++) {
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
}

export function scenario<T extends object>(title: string, ctxFactory: CtxFactory<T>) {
  return new ScenarioTest(title, ctxFactory);
}
