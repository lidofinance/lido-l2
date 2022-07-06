import { CrossChainMessenger } from "@eth-optimism/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const {
    l1: { signer: l1Signer },
    l2: { signer: l2Signer },
  } = network.getMultichainNetwork("optimism");

  const txHash = env.string("TX_HASH");

  const crossDomainMessenger = new CrossChainMessenger({
    l1ChainId: await l1Signer.getChainId(),
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  });

  console.log("Finalizing the L2 -> L1 message");
  await crossDomainMessenger.finalizeMessage(txHash);
  console.log("Message successfully finalized!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
