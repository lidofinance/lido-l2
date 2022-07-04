import chai, { expect } from "chai";
import { BigNumber, BigNumberish, Contract, ContractTransaction } from "ethers";

chai.util.addMethod(chai.assert, "revertsWith", async function <
  T
>(promise: Promise<T>, error: string) {
  await chai.expect(promise).to.be.revertedWith(error);
});

chai.util.addMethod(
  chai.assert,
  "emits",
  async (
    contract: Contract,
    tx: ContractTransaction,
    eventName: string,
    args?: unknown[]
  ) => {
    const exp = expect(tx).to.emit(contract, eventName);
    if (args) {
      exp.withArgs(...args);
    }
    await exp;
  }
);

chai.util.addMethod(
  chai.assert,
  "notEmits",
  async (contract: Contract, tx: ContractTransaction, eventName: string) => {
    await expect(tx).to.not.emit(contract, eventName);
  }
);

chai.util.addMethod(
  chai.assert,
  "equalBN",
  (actual: BigNumberish, expected: BigNumberish) => {
    chai.assert.deepEqual(BigNumber.from(actual), BigNumber.from(expected));
  }
);
