import chalk from "chalk";
import {
  BigNumber,
  Contract,
  ContractFactory,
  ContractTransaction,
  Signer,
  Wallet,
} from "ethers";
import network from "../network";

interface TypechainFactoryConstructor<
  T extends ContractFactory = ContractFactory
> {
  new (signer: Signer): T;
  abi: Record<string, any>[];
}

interface DeployStep<T extends ContractFactory = ContractFactory> {
  factory: TypechainFactoryConstructor<T>;
  args: Parameters<T["deploy"]>;
  afterDeploy?: (
    contract: Awaited<ReturnType<T["deploy"]>>
  ) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}

interface DeployStepInfo {
  contractName: string;
  index: number;
  args: { index: number; name: string; value: string | number }[];
}

interface ABIItem {
  inputs: { name: string }[];
  type: string;
}

interface PrintOptions {
  padding?: number;
  prefix?: string;
}

export interface Logger {
  log(...args: any[]): void;
}

const DEFAULT_CONSTRUCTOR_ABI = {
  type: "constructor",
  stateMutability: "nonpayable",
  inputs: [],
};

export class DeployScript {
  private readonly logger?: Logger;
  private readonly steps: DeployStep<ContractFactory>[] = [];
  private contracts: Contract[] = [];
  public readonly deployer: Wallet;

  constructor(deployer: Wallet, logger?: Logger) {
    this.deployer = deployer;
    this.logger = logger;
  }

  addStep<T extends ContractFactory>(step: DeployStep<T>): DeployScript {
    this.steps.push(step);
    return this;
  }

  async run() {
    const res: Contract[] = [];
    for (let i = 0; i < this.steps.length; ++i) {
      this._printStepInfo(this._getStepInfo(i), { prefix: "Deploying " });
      const c = await this.runStep(this.deployer, i);
      res.push(c);
      this._log();
    }
    this.contracts = res;
    return res;
  }

  print(printOptions?: PrintOptions) {
    for (let i = 0; i < this.steps.length; ++i) {
      this._printStepInfo(this._getStepInfo(i), {
        padding: 2,
        prefix: "Deploy ",
        ...printOptions,
      });
      this._log();
    }
  }

  private async runStep(deployer: Wallet, index: number) {
    const step = this.steps[index];
    const Factory = step.factory;
    const factoryName = Factory.name.split("_")[0];
    const contract = await new Factory(deployer).deploy(...step.args);
    const deployTx = contract.deployTransaction;
    this._log(`Waiting for tx: ${getBlockExplorerTxLinkByChainId(deployTx)}`);
    await deployTx.wait();
    this._log(
      `Contract ${chalk.yellow(
        factoryName
      )} deployed at: ${getBlockExplorerAddressLinkByChainId(
        deployTx.chainId,
        contract.address
      )}`
    );
    if (step.afterDeploy) {
      step.afterDeploy(contract);
    }
    await this._printVerificationCommand(
      contract.address,
      this._getStepInfo(index)
    );
    return contract;
  }

  getContractAddress(stepIndex: number): string {
    return this.contracts[stepIndex].address;
  }

  private _getStepInfo(index: number) {
    const step = this.steps[index];
    const contractName = step.factory.name.split("_")[0];
    const res: DeployStepInfo = { index, contractName, args: [] };
    const { abi } = step.factory;
    const constructorABI = this._findConstructABI(abi);

    for (let i = 0; i < constructorABI.inputs.length; ++i) {
      const name = constructorABI.inputs[i]?.name || "<UNKNOWN>";
      res.args.push({ index: i, name, value: step.args[i] });
    }
    return res;
  }

  _findConstructABI(abi: Record<string, any>[]) {
    return (abi.find((i) => i.type === "constructor") ||
      DEFAULT_CONSTRUCTOR_ABI) as ABIItem;
  }

  private _printStepInfo(
    stepInfo: DeployStepInfo,
    printOptions: PrintOptions = {}
  ) {
    const padString = "".padStart(printOptions.padding || 0);
    const contractName = chalk.yellowBright(stepInfo.contractName);
    const title = `${padString}${stepInfo.index + 1}/${this.steps.length}: ${
      printOptions.prefix || ""
    }${contractName}`;
    this._log(title);

    for (const arg of stepInfo.args) {
      const name = chalk.italic.cyan(arg.name);
      const value = formatValue(arg.value);
      this._log(
        `${padString}  ${chalk.cyan(arg.index + ":")} ${name}  ${value}`
      );
    }
  }

  private async _printVerificationCommand(
    address: string,
    stepInfo: DeployStepInfo
  ) {
    const chainId = await this.deployer.getChainId();
    const networkNameByChainId: Record<number, string> = {
      1: "eth_mainnet",
      11155111: "eth_sepolia",
      10: "opt_mainnet",
      11155420: "opt_sepolia",
      31337: "hardhat",
      42161: "arb_mainnet",
      421613: "arb_sepolia",
    };
    const networkName = networkNameByChainId[chainId] || "<NETWORK_NAME>";
    const arsString = stepInfo.args.map((a) => `"${a.value}"`).join(" ");
    this._log("To verify the contract on Etherscan, use command:");
    this._log(
      `npx hardhat verify --network ${networkName} ${address} ${arsString}`
    );
  }

  private _log(message: string = "") {
    this.logger?.log(message);
  }
}

function formatValue(value: string | number) {
  if (value.toString().startsWith("0x")) {
    return chalk.underline.green(value);
  }
  if (BigNumber.isBigNumber(value) || Number.isFinite(+value)) {
    return chalk.green(value);
  }
  return chalk.green(`"${value}"`);
}

function getBlockExplorerAddressLinkByChainId(
  chainId: number,
  address: string
) {
  const baseURL = network.blockExplorerBaseUrl(chainId);
  return chalk.gray.underline(`${baseURL}/address/${address}`);
}

function getBlockExplorerTxLinkByChainId(tx: ContractTransaction) {
  const baseURL = network.blockExplorerBaseUrl(tx.chainId);
  return baseURL ? chalk.gray.underline(`${baseURL}/tx/${tx.hash}`) : tx.hash;
}
