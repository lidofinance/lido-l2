import { BigNumberish, Wallet } from "ethers";
import { EVMScriptDecoder } from "@lidofinance/evm-script-decoder";
import {
  Agent__factory,
  TokenManager__factory,
  Voting__factory,
} from "../typechain/";
import { SignerOrProvider } from "./network";
import { sleep } from "./testing/e2e";

interface AragonDAOAddresses {
  agent: string;
  voting: string;
  tokenManager: string;
}

export interface EVMScriptCallItem {
  address: string;
  signature: string;
  decodedCallData: unknown[];
}

export default function aragon(
  addresses: AragonDAOAddresses,
  signerOrProvider: SignerOrProvider
) {
  const evmScriptDecoder = new EVMScriptDecoder();
  const agent = Agent__factory.connect(addresses.agent, signerOrProvider);
  const voting = Voting__factory.connect(addresses.voting, signerOrProvider);

  return {
    agent,
    voting,
    async voteAndExecute(
      ldoHolder: Wallet,
      voteId: BigNumberish,
      isSupports: boolean = true
    ) {
      const voteTx = await voting
        .connect(ldoHolder)
        .vote(voteId, isSupports, true);
      await voteTx.wait();

      const vote = await voting.getVote(voteId);
      if (vote.executed) {
        return voteTx;
      }

      while (!(await voting.canExecute(voteId))) {
        await sleep(15_000); // 15 sec avg 1 block time
      }
      return voting.connect(ldoHolder).executeVote(voteId);
    },
    async createVote(
      ldoHolder: Wallet,
      metadata: string,
      ...evmScriptCalls: EVMScriptCallItem[]
    ) {
      const evmScript = await evmScriptDecoder.encodeEVMScript({
        calls: evmScriptCalls,
      });

      const newVotingEVMScript = await evmScriptDecoder.encodeEVMScript({
        address: voting.address,
        calls: [
          {
            signature: "newVote(bytes,string)",
            decodedCallData: [evmScript, metadata],
          },
        ],
      });

      const tokenManager = TokenManager__factory.connect(
        addresses.tokenManager,
        ldoHolder
      );
      return tokenManager.forward(newVotingEVMScript);
    },
  };
}
