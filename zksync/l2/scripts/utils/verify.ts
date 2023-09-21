import { run } from "hardhat";
import { IS_LOCAL } from "./constants";

export async function verify(address: string) {
  if (!IS_LOCAL)
    return run("verify:verify", {
      address,
    });
}
