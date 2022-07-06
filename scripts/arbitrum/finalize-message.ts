import { L2ToL1MessageStatus, L2TransactionReceipt } from "@arbitrum/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const {
    l1: { signer: l1Signer, provider: l1Provider },
    l2: { provider: l2Provider },
  } = network.getMultichainNetwork("arbitrum");

  const l2TxHash = env.string("TX_HASH");

  const receipt = await l2Provider.getTransactionReceipt(l2TxHash);
  const l2Receipt = new L2TransactionReceipt(receipt);

  const messages = await l2Receipt.getL2ToL1Messages(l1Signer, l2Provider);

  const l2ToL1Msg = messages[0];

  const status = await l2ToL1Msg.status(l2Provider);
  if (status === L2ToL1MessageStatus.EXECUTED) {
    console.log(`Message already executed! Nothing else to do here`);
    return;
  }

  const timeToWaitMs = 1000 * 60;
  const [estimatedConfirmationBlock, currentBlock] = await Promise.all([
    l2ToL1Msg.getFirstExecutableBlock(l2Provider),
    l1Provider.getBlockNumber(),
  ]);

  if (estimatedConfirmationBlock) {
    console.log(
      `Estimated block number tx will be confirmed: ${estimatedConfirmationBlock.toString()}`
    );
    console.log(`Current block number is ${currentBlock}`);
  }
  console.log("Waiting for the outbox entry to be created...");

  await l2ToL1Msg.waitUntilReadyToExecute(l2Provider, timeToWaitMs);
  console.log("Outbox entry exists! Trying to execute now");

  const res = await l2ToL1Msg.execute(l2Provider);
  const rec = await res.wait();
  console.log("Done! Your transaction is executed", rec);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
