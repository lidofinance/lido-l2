import { Wallet, Provider, Contract } from "zksync-web3";
import * as ethers from "ethers";
import * as path from "path";
import {
  getAddressFromEnv,
  web3Provider,
  zkSyncUrl,
  readInterface,
} from "../utils/utils";
import { richWallet } from "../utils/rich_wallet";
import { SYSTEM_CONFIG_CONSTANTS } from "../utils/constants";

const l1ArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "artifacts/l1/contracts"
);

const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../../..", "l2"),
  "artifacts-zk/l2/contracts"
);

const L1_LIDO_BRIDGE_PROXY_ADDR = getAddressFromEnv(
  "CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR"
);
const L1_LIDO_BRIDGE_PROXY_INTERFACE = readInterface(
  l1ArtifactsPath,
  "L1ERC20Bridge"
);
const L1_LIDO_TOKEN_ADDR = getAddressFromEnv("CONTRACTS_L1_LIDO_TOKEN_ADDR");
const L1_LIDO_TOKEN_INTERFACE = readInterface(
  path.join(l1ArtifactsPath, "token"),
  "ERC20Token"
);

const L2_LIDO_BRIDGE_PROXY_ADDR = getAddressFromEnv(
  "CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR"
);
const L2_LIDO_BRIDGE_PROXY_INTERFACE = readInterface(
  l2ArtifactsPath,
  "L2ERC20Bridge"
);
const L2_LIDO_TOKEN_ADDR = getAddressFromEnv("CONTRACTS_L2_LIDO_TOKEN_ADDR");
const L2_LIDO_TOKEN_INTERFACE = readInterface(
  path.join(l2ArtifactsPath, "token"),
  "ERC20BridgedUpgradeable"
);

const AMOUNT_TO_WITHDRAW = ethers.utils.parseEther("1");

const { address: WALLET_ADDRESS, privateKey: WALLET_PRIVATE_KEY } =
  richWallet[0];

const provider = web3Provider();
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
const zkProvider = new Provider(zkSyncUrl(), SYSTEM_CONFIG_CONSTANTS.CHAIND_ID);
const zkWallet = new Wallet(WALLET_PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log("Running script to withdraw ERC20 from zkSync");

  const l1TokenContract = new ethers.Contract(
    L1_LIDO_TOKEN_ADDR,
    L1_LIDO_TOKEN_INTERFACE,
    wallet
  );
  const l1BridgeContract = new ethers.Contract(
    L1_LIDO_BRIDGE_PROXY_ADDR,
    L1_LIDO_BRIDGE_PROXY_INTERFACE,
    wallet
  );
  const l2TokenContract = new Contract(
    L2_LIDO_TOKEN_ADDR,
    L2_LIDO_TOKEN_INTERFACE,
    zkWallet
  );
  const l2BridgeContract = new Contract(
    L2_LIDO_BRIDGE_PROXY_ADDR,
    L2_LIDO_BRIDGE_PROXY_INTERFACE,
    zkWallet
  );

  console.log("\n================== BEFORE WITHDRAW =================");
  console.log(
    `Account token balance on L1: ${await l1TokenContract.balanceOf(
      WALLET_ADDRESS
    )}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(
      l1BridgeContract.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2TokenContract.balanceOf(
      WALLET_ADDRESS
    )}`
  );

  // Withdrawal on L2

  const withdrawResponse = await l2BridgeContract.withdraw(
    WALLET_ADDRESS,
    l2TokenContract.address,
    AMOUNT_TO_WITHDRAW,
    { gasLimit: 10_000_000 }
  );
  await withdrawResponse.wait();

  const { blockNumber, l1BatchNumber, l1BatchTxIndex } =
    await withdrawResponse.waitFinalize();

  // Finalize Withdrawal on L1

  const message = ethers.utils.solidityPack(
    ["bytes4", "address", "address", "uint256"],
    [
      L1_LIDO_BRIDGE_PROXY_INTERFACE.getSighash(
        L1_LIDO_BRIDGE_PROXY_INTERFACE.getFunction("finalizeWithdrawal")
      ),
      WALLET_ADDRESS,
      l1TokenContract.address,
      AMOUNT_TO_WITHDRAW,
    ]
  );

  const messageProof = await zkProvider.getMessageProof(
    blockNumber,
    l2BridgeContract.address,
    ethers.utils.keccak256(message)
  );

  const finalizeWithdrawResponse = await l1BridgeContract.finalizeWithdrawal(
    l1BatchNumber,
    messageProof?.id,
    l1BatchTxIndex,
    message,
    messageProof?.proof,
    { gasLimit: 10_000_000 }
  );
  await finalizeWithdrawResponse.wait();

  console.log("\n================== AFTER FINALIZE WITHDRAW =================");
  console.log(
    `Account token balance on L1: ${await l1TokenContract.balanceOf(
      WALLET_ADDRESS
    )}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(
      l1BridgeContract.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2TokenContract.balanceOf(
      WALLET_ADDRESS
    )}`
  );
}

main().catch((err) => {
  throw err;
});
