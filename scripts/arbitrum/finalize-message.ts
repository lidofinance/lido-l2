import { L2ToL1MessageStatus, L2TransactionReceipt } from "@arbitrum/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const networkName = env.network();
  const ethArbNetwork = network.multichain(["eth", "arb"], networkName);

  const [ethProvider, arbProvider] = ethArbNetwork.getProviders({
    forking: false,
  });
  const [ethSigner] = ethArbNetwork.getSigners(env.privateKey(), {
    forking: false,
  });

  const l2TxHash = env.string("TX_HASH");

  console.log("Tx hash:", l2TxHash);

  const receipt = await arbProvider.getTransactionReceipt(l2TxHash);

  if (!receipt) {
    throw new Error(
      `Receipt for tx ${l2TxHash} not found on "${networkName}" network`
    );
  }
  console.log(`Receipt for tx found!`);

  const l2Receipt = new L2TransactionReceipt(receipt);

  const messages = await l2Receipt.getL2ToL1Messages(ethSigner, arbProvider);

  const l2ToL1Msg = messages[0];

  const status = await l2ToL1Msg.status(arbProvider);
  if (status === L2ToL1MessageStatus.EXECUTED) {
    console.log(`Message already executed! Nothing else to do here`);
    return;
  }

  const timeToWaitMs = 1000 * 60;
  const [estimatedConfirmationBlock, currentBlock] = await Promise.all([
    l2ToL1Msg.getFirstExecutableBlock(arbProvider),
    ethProvider.getBlockNumber(),
  ]);

  if (estimatedConfirmationBlock) {
    console.log(
      `Estimated block number tx will be confirmed: ${estimatedConfirmationBlock.toString()}`
    );
    console.log(`Current block number is ${currentBlock}`);
  }
  console.log("Waiting for the outbox entry to be created...");

  await l2ToL1Msg.waitUntilReadyToExecute(arbProvider, timeToWaitMs);
  console.log("Outbox entry exists! Trying to execute now");

  const res = await l2ToL1Msg.execute(arbProvider);
  const rec = await res.wait();
  console.log("Done! Your transaction is executed", rec);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
