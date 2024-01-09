import aragon from "./aragon";
import { SignerOrProvider } from "./network";

type AragonEnvSetupName = "mainnet" | "mainnet_test" | "goerli";

const ARAGON_MAINNET_TESTING = {
  agent: "0x184d39300f2fA4419d04998e9C58Cb5De586d879",
  voting: "0x124208720f804A9ded96F0CD532018614b8aE28d",
  tokenManager: "0xdAc681011f846Af90AEbd11d0C9Cc6BCa70Dd636",
};

const ARAGON_MAINNET = {
  agent: "0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c",
  voting: "0x2e59A20f205bB85a89C53f1936454680651E618e",
  tokenManager: "0xf73a1260d222f447210581DDf212D915c09a3249",
};

const ARAGON_GOERLI = {
  agent: "0x45B1F6E7ABFf8A8bf516554634Abf37D73C79fBC",
  voting: "0xfDdA522eF6626e155d47Be0aeF74c204CfB3d2c4",
  tokenManager: "0xF3BfaD8a6960ad130e02c9d14262788dea2C3Cd5",
};

const ARAGON_CONTRACTS_BY_NAME = {
  mainnet: ARAGON_MAINNET,
  mainnet_test: ARAGON_MAINNET_TESTING,
  goerli: ARAGON_GOERLI,
};

export default function lido(
  envSetupName: AragonEnvSetupName,
  signerOrProvider: SignerOrProvider
) {
  return aragon(ARAGON_CONTRACTS_BY_NAME[envSetupName], signerOrProvider);
}
