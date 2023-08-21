import { CrossChainMessenger, MessageStatus } from "@mantleio/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const networkName = env.network();
  const [l1Signer, l2Signer] = network
    .multichain(["eth", "mnt"], networkName)
    .getSigners(env.privateKey(), { forking: false });

  const txHash = env.string("TX_HASH");

  const crossChainMessenger = new CrossChainMessenger({
    l1ChainId: network.chainId("eth", networkName),
    l2ChainId: network.chainId("mnt", networkName),
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  });

  const status = await crossChainMessenger.getMessageStatus(txHash);

  // if (status !== MessageStatus.READY_TO_PROVE) {
  //   throw new Error(`Invalid tx status: ${status}`);
  // }

  // console.log("Prove the L2 -> L1 message");
  // const tx = await crossChainMessenger.proveMessage(txHash);
  // console.log(`Waiting for the prove tx ${tx.hash}...`);
  // await tx.wait();
  // console.log(`Message was proved successfully!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
