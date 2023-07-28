import { L1ToL2MessageGasEstimator, L1TransactionReceipt } from "@arbitrum/sdk";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, BigNumberish } from "ethers";
import { hexDataLength } from "ethers/lib/utils";
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

const SUBMISSION_PRICE_MULTIPLIER = 2;

async function getRetryableTicketSendParams(
  ethProvider: JsonRpcProvider,
  arbProvider: JsonRpcProvider,
  msg: MessageData
) {
  const l1ToL2MessageGasEstimator = new L1ToL2MessageGasEstimator(arbProvider);

  const { baseFeePerGas } = await ethProvider.getBlock(
    await ethProvider.getBlockNumber()
  );
  if (!baseFeePerGas) {
    throw new Error(
      "Latest block did not contain base fee, ensure provider is connected to a network that supports EIP 1559."
    );
  }

  const maxSubmissionCost = await l1ToL2MessageGasEstimator
    .estimateSubmissionFee(
      ethProvider,
      baseFeePerGas,
      hexDataLength(msg.calldata) + 4
    )
    .then((submissionPrice) =>
      submissionPrice.mul(SUBMISSION_PRICE_MULTIPLIER)
    );

  const arbGasPriceBid = await arbProvider.getGasPrice();

  const maxGas =
    await l1ToL2MessageGasEstimator.estimateRetryableTicketGasLimit({
      from: msg.sender,
      to: msg.recipient,
      l2CallValue: BigNumber.from(msg.callvalue || 0),
      excessFeeRefundAddress: msg.refundAddress || msg.sender,
      callValueRefundAddress: msg.refundAddress || msg.sender,
      data: msg.calldata,
    });

  return {
    maxGas,
    maxSubmissionCost,
    gasPriceBid: arbGasPriceBid,
    callvalue: maxSubmissionCost.add(arbGasPriceBid.mul(maxGas)),
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
      const [message] = await l1TxReceipt.getL1ToL2Messages(arbProvider);
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
