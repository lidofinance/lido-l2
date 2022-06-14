import hre, { ethers } from "hardhat";

export function scenario<T>(
  title: string,
  ctxBuilder: () => Promise<T>,
  tests: (ctx: T) => void
) {
  describe(title, () => {
    // @ts-ignore
    let ctx: T = {};
    before(async () => {
      ctx = Object.assign(ctx, await ctxBuilder());
    });

    tests(ctx);
  });
}

export function testsuite<T>(
  title: string,
  ctxBuilder: () => Promise<T>,
  tests: (ctx: T) => void
) {
  describe(title, () => {
    let evmSnapshotId: string;
    // @ts-ignore
    let ctx: T = {};
    before(async () => {
      ctx = Object.assign(ctx, await ctxBuilder());
      evmSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
      await hre.ethers.provider.send("evm_revert", [evmSnapshotId]);
      evmSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    });
    tests(ctx);
  });
}

export function accessControlRevertMessage(role: string, address: string) {
  return `AccessControl: account ${address.toLowerCase()} is missing role ${role}`;
}
