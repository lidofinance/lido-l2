import aragon from "./aragon";
import { SignerOrProvider } from "./network";

type AragonEnvSetupName =
  | "mainnet"
  | "mainnet_test"
  | "kovan"
  | "rinkeby"
  | "goerli";

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

const ARAGON_KOVAN = {
  agent: "0x80720229bdB8caf9f67ddf871e98a76655A39AFe",
  voting: "0x86f4C03aB9fCE83970Ce3FC7C23f25339f484EE5",
  tokenManager: "0x4A63e41611B7c70DA6f42a806dFBcECB0B2D314F",
};

const ARAGON_RINKEBY = {
  agent: "0x12869c3349f993C5c20BAB9482b7d16Aff0Ae2f9",
  voting: "0x04F9590D3EEC8e619D7714ffeF664aD3fd53b880",
  tokenManager: "0x1ee7E87486f9ae6E27A5e58310a5319394360Cf0",
};

const ARAGON_GOERLI = {
  agent: "0x4333218072D5d7008546737786663c38B4D561A4",
  voting: "0xbc0B67b4553f4CF52a913DE9A6eD0057E2E758Db",
  tokenManager: "0xDfe76d11b365f5e0023343A367f0b311701B3bc1",
};

const ARAGON_CONTRACTS_BY_NAME = {
  mainnet: ARAGON_MAINNET,
  mainnet_test: ARAGON_MAINNET_TESTING,
  kovan: ARAGON_KOVAN,
  rinkeby: ARAGON_RINKEBY,
  goerli: ARAGON_GOERLI,
};

export default function lido(
  envSetupName: AragonEnvSetupName,
  signerOrProvider: SignerOrProvider
) {
  return aragon(ARAGON_CONTRACTS_BY_NAME[envSetupName], signerOrProvider);
}
