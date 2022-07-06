export type CtxFactory<T> = () => Promise<T>;

export type CtxFn<T> = (ctx: T) => Promise<void>;

export interface StepTest<T> {
  title: string;
  test: CtxFn<T>;
}
