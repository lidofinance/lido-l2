import { L1ToL2MessageGasEstimator, L1TransactionReceipt } from "@arbitrum/sdk";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, BigNumberish, ethers } from "ethers";
import network, { NetworkName } from "../network";
import contracts from "./contracts";

import { CommonOptions } from "./types";

interface RetryableTicketOptions extends CommonOptions {
  forking: boolean;
}

interface MessageData {
  sender: string;
  recipient: string;
  calldata: string;
  callvalue?: BigNumberish;
  refundAddress?: string;
}

const SUBMISSION_PRICE_MULTIPLIER = 5;

async function getRetryableTicketSendParams(
  ethProvider: JsonRpcProvider,
  arbProvider: JsonRpcProvider,
  msg: MessageData
) {
  const l1ToL2MessageGasEstimator = new L1ToL2MessageGasEstimator(arbProvider);
  const maxSubmissionCost = await l1ToL2MessageGasEstimator
    .estimateSubmissionFee(
      ethProvider,
      await ethProvider.getGasPrice(),
      msg.calldata.length
    )
    .then((submissionPrice) =>
      submissionPrice.mul(SUBMISSION_PRICE_MULTIPLIER)
    );
  const gasPriceBid = await arbProvider.getGasPrice();
  const maxGas =
    await l1ToL2MessageGasEstimator.estimateRetryableTicketGasLimit(
      msg.sender,
      msg.recipient,
      BigNumber.from(msg.callvalue || 0),
      msg.refundAddress || msg.sender,
      msg.refundAddress || msg.sender,
      msg.calldata,
      ethers.utils.parseEther("1"),
      maxSubmissionCost,
      BigNumber.from(1_000_000),
      gasPriceBid
    );

  return {
    maxGas,
    gasPriceBid,
    maxSubmissionCost,
    callvalue: maxSubmissionCost.add(gasPriceBid.mul(maxGas)),
  };
}

export default function messaging(
  networkName: NetworkName,
  options: RetryableTicketOptions
) {
  const [ethProvider, arbProvider] = network
    .multichain(["eth", "arb"], networkName)
    .getProviders(options);
  const arbContracts = contracts(networkName, options);
  return {
    async waitForL2Message(l1TxHash: string) {
      const l1TxReceipt = new L1TransactionReceipt(
        await ethProvider.getTransactionReceipt(l1TxHash)
      );
      const message = await l1TxReceipt.getL1ToL2Message(arbProvider);
      return message.waitForStatus();
    },
    async getRetryableTicketSendParams(msg: MessageData) {
      return getRetryableTicketSendParams(ethProvider, arbProvider, msg);
    },
    async prepareRetryableTicketTx(msg: MessageData) {
      const { maxGas, gasPriceBid, maxSubmissionCost, callvalue } =
        await getRetryableTicketSendParams(ethProvider, arbProvider, msg);

      return {
        callvalue,
        calldata: arbContracts.Inbox.interface.encodeFunctionData(
          "createRetryableTicket",
          [
            msg.recipient,
            BigNumber.from(msg.callvalue || 0),
            maxSubmissionCost,
            msg.refundAddress || msg.sender,
            msg.refundAddress || msg.sender,
            maxGas,
            gasPriceBid,
            msg.calldata,
          ]
        ),
      };
    },
  };
}
