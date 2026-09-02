import hre from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ERC20BridgedPermit__factory,
  ERC20BridgedPermitMintableStub__factory,
  TokenRateOracle__factory,
  ERC20RebasableBridgedPermit__factory,
  OssifiableProxy__factory,
  TokenRateOracle,
  ERC20BridgedPermit
} from "../../typechain";

/// @dev Deploys the mintable stub rather than `ERC20BridgedPermit` itself: the token carries no
///      mint/burn authority of its own, so a test needs some way to create supply. Everything the
///      suites exercise -- ERC20 core, metadata, permit, versioning -- is inherited unchanged.
export async function erc20BridgedPermitUnderProxy(
  deployer: SignerWithAddress,
  holder: SignerWithAddress,
  name: string,
  symbol: string,
  version: string,
  decimals: BigNumber
) {
  const erc20BridgedPermitImpl = await new ERC20BridgedPermitMintableStub__factory(deployer).deploy(
    name,
    symbol,
    version,
    decimals
  );

  const erc20BridgedPermitProxy = await new OssifiableProxy__factory(deployer).deploy(
    erc20BridgedPermitImpl.address,
    deployer.address,
    ERC20BridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
      name,
      symbol,
      version
    ])
  );

  return ERC20BridgedPermitMintableStub__factory.connect(
    erc20BridgedPermitProxy.address,
    holder
  );
}

export async function tokenRateOracleUnderProxy(
  deployer: SignerWithAddress,
  messenger: string,
  l2ERC20TokenBridge: string,
  l1TokenRatePusher: string,
  tokenRateOutdatedDelay: BigNumber,
  maxAllowedL2ToL1ClockLag: BigNumber,
  maxAllowedTokenRateDeviationPerDay: BigNumber,
  oldestRateAllowedInPauseTimeSpan: BigNumber,
  minTimeBetweenTokenRateUpdates: BigNumber,
  tokenRate: BigNumber,
  rateL1Timestamp: BigNumber
) {
  const tokenRateOracleImpl = await new TokenRateOracle__factory(deployer).deploy(
    messenger,
    l2ERC20TokenBridge,
    l1TokenRatePusher,
    tokenRateOutdatedDelay,
    maxAllowedL2ToL1ClockLag,
    maxAllowedTokenRateDeviationPerDay,
    oldestRateAllowedInPauseTimeSpan,
    minTimeBetweenTokenRateUpdates
  );

  const tokenRateOracleProxy = new OssifiableProxy__factory(deployer);

  const unsignedTx = tokenRateOracleProxy.getDeployTransaction(tokenRateOracleImpl.address,
    deployer.address,
    tokenRateOracleImpl.interface.encodeFunctionData("initialize", [
      deployer.address,
      tokenRate,
      rateL1Timestamp
    ]));

  const response = await deployer.sendTransaction(unsignedTx);
  const provider = await hre.ethers.provider;
  const contractReceipt = await response.wait();
  const blockTimestampOfDeployment = BigNumber.from((await provider.getBlock(contractReceipt.blockNumber)).timestamp);
  const txResponse = await response.wait();

  const tokenRateOracle = TokenRateOracle__factory.connect(
    txResponse.contractAddress,
    deployer
  );

  return { tokenRateOracle, blockTimestampOfDeployment };
}

export async function erc20RebasableBridgedPermitUnderProxy(
  deployer: SignerWithAddress,
  holder: SignerWithAddress,
  name: string,
  symbol: string,
  version: string,
  decimals: BigNumber,
  tokenRateOracle: TokenRateOracle,
  erc20BridgedPermit: ERC20BridgedPermit,
  bridge: string
) {
  const erc20RebasableBridgedPermitImpl = await new ERC20RebasableBridgedPermit__factory(deployer).deploy(
    name,
    symbol,
    version,
    decimals,
    erc20BridgedPermit.address,
    tokenRateOracle.address,
    bridge
  );

  const erc20RebasableBridgedPermitProxy = await new OssifiableProxy__factory(deployer).deploy(
    erc20RebasableBridgedPermitImpl.address,
    deployer.address,
    ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
      name,
      symbol,
      version,
    ])
  );

  return ERC20RebasableBridgedPermit__factory.connect(
    erc20RebasableBridgedPermitProxy.address,
    holder
  );
}
