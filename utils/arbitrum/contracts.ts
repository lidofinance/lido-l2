import { Signer } from "ethers";
import { ArbitrumContractAddresses } from "./addresses";
import {
  L1GatewayRouter__factory,
  L2GatewayRouter,
  L2GatewayRouter__factory,
  L1GatewayRouter,
  ArbSysStub,
  ArbSysStub__factory,
} from "../../typechain/";
import { Provider } from "@ethersproject/providers";

type SignerOrProvider = Signer | Provider;

export class ArbitrumContracts {
  private readonly addresses: ArbitrumContractAddresses;
  public readonly L1GatewayRouter: L1GatewayRouter;
  public readonly L2GatewayRouter: L2GatewayRouter;
  public readonly ArbSys: ArbSysStub;

  constructor(
    l1SignerOrProvider: SignerOrProvider,
    l2SignerOrProvider: SignerOrProvider,
    addresses: ArbitrumContractAddresses
  ) {
    this.addresses = addresses;

    this.L1GatewayRouter = L1GatewayRouter__factory.connect(
      this.addresses.L1GatewayRouter,
      l1SignerOrProvider
    );

    this.ArbSys = ArbSysStub__factory.connect(
      this.addresses.ArbSys,
      l2SignerOrProvider
    );

    this.L2GatewayRouter = L2GatewayRouter__factory.connect(
      this.addresses.L2GatewayRouter,
      l2SignerOrProvider
    );
  }
}

export default {
  get(
    addresses: ArbitrumContractAddresses,
    l1SignerOrProvider: SignerOrProvider,
    l2SignerOrProvider: SignerOrProvider
  ) {
    return new ArbitrumContracts(
      l1SignerOrProvider,
      l2SignerOrProvider,
      addresses
    );
  },
};
