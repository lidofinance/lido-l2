import { ADDRESSES } from "./utils/constants";
import { verify } from "./utils/verify";

async function main() {
  await verify(ADDRESSES.L2_LIDO_BRIDGE_PROXY_ADDR);
}

main().catch((error) => {
  throw error;
});
