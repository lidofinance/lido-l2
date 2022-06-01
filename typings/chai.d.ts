declare module "chai" {
  import { BigNumberish, Contract, ContractTransaction } from "ethers";
  global {
    export namespace Chai {
      interface AssertStatic {
        revertsWith<T>(promise: Promise<T>, error: string): Promise<void>;
        emits(
          contract: Contract,
          tx: ContractTransaction,
          eventName: string,
          args?: unknown[]
        ): Promise<void>;
        notEmits(
          contract: Contract,
          tx: ContractTransaction,
          eventName: string
        ): Promise<void>;
        equalBN(actual: BigNumberish, expected: BigNumberish): void;
      }
    }
  }
}
