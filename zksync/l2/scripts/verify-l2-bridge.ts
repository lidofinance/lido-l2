import * as hre from "hardhat";
import { ADDRESSES } from "./utils/constants";

async function main() {
  await hre.run("verify:verify", {
    address: ADDRESSES.L2_LIDO_BRIDGE_PROXY_ADDR,
  });
}

main().catch((error) => {
  throw error;
});
