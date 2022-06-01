import hre from "hardhat";

export class TestContext {
  private _snapshotId?: string;
  public static async create<T>(builder: () => Promise<T>) {
    const result = new TestContext();
    const data = await builder();
    return Object.assign(result, data);
  }

  async snapshot() {
    this._snapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  }

  async revert() {
    if (!this._snapshotId) {
      throw Error("No snapshot to revert");
    }
    await hre.ethers.provider.send("evm_revert", [this._snapshotId]);
    this._snapshotId = undefined;
  }
}
