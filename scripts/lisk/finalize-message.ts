import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const networkName = env.network();
  const [l1Signer, l2Signer] = network
    .multichain(["eth", "lisk"], networkName)
    .getSigners(env.privateKey(), { forking: false });

  const txHash = env.string("TX_HASH");

  const crossDomainMessenger = new CrossChainMessenger({
    l1ChainId: network.chainId("eth", networkName),
    l2ChainId: network.chainId("lisk", networkName),
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  });

  const status = await crossDomainMessenger.getMessageStatus(txHash);

  if (status !== MessageStatus.READY_FOR_RELAY) {
    throw new Error(`Invalid tx status: ${status}`);
  }

  console.log("Finalizing the L2 -> L1 message");
  await crossDomainMessenger.finalizeMessage(txHash);
  console.log("Message successfully finalized!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
