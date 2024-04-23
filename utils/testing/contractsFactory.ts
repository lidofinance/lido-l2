import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    ERC20BridgedPermit__factory,
    TokenRateOracle__factory,
    ERC20RebasableBridgedPermit__factory,
    OssifiableProxy__factory
} from "../../typechain";

export async function erc20BridgedPermitUnderProxy(
    deployer: SignerWithAddress,
    holder: SignerWithAddress,
    name: string,
    symbol: string,
    version: string,
    decimals: BigNumber,
    bridge: string
) {
    const erc20BridgedPermitImpl = await new ERC20BridgedPermit__factory(deployer).deploy(
        name,
        symbol,
        version,
        decimals,
        bridge
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

      const erc20BridgedPermit = ERC20BridgedPermit__factory.connect(
        erc20BridgedPermitProxy.address,
        holder
      );

      return erc20BridgedPermit;
}

export async function tokenRateOracleUnderProxy(
    deployer: SignerWithAddress,
    messenger: string,
    l2ERC20TokenBridge: string,
    l1TokenRatePusher: string,
    tokenRateOutdatedDelay: BigNumber,
    maxAllowedL2ToL1ClockLag: BigNumber,
    maxAllowedTokenRateDeviationPerDay: BigNumber,
    tokenRate: BigNumber,
    blockTimestamp: BigNumber
) {
    const tokenRateOracleImpl = await new TokenRateOracle__factory(deployer).deploy(
        messenger,
        l2ERC20TokenBridge,
        l1TokenRatePusher,
        tokenRateOutdatedDelay,
        maxAllowedL2ToL1ClockLag,
        maxAllowedTokenRateDeviationPerDay
    );
    const tokenRateOracleProxy = await new OssifiableProxy__factory(
        deployer
    ).deploy(
        tokenRateOracleImpl.address,
        deployer.address,
        tokenRateOracleImpl.interface.encodeFunctionData("initialize", [
            tokenRate,
            blockTimestamp
        ])
    );
    const tokenRateOracle = TokenRateOracle__factory.connect(
        tokenRateOracleProxy.address,
        deployer
    );
    return tokenRateOracle;
}

export async function erc20RebasableBridgedPermitUnderProxy(
    deployer: SignerWithAddress,

    erc20BridgedPermitName: string,
    erc20BridgedPermitSymbol: string,
    erc20BridgedPermitVersion: string,

    erc20RebasableBridgedPermitName: string,
    erc20RebasableBridgedPermitSymbol: string,
    erc20RebasableBridgedPermitVersion: string,

    decimals: BigNumber,
    bridge: string,

    messenger: string,
    l1TokenRatePusher: string,
    tokenRateOutdatedDelay: BigNumber,
    maxAllowedL2ToL1ClockLag: BigNumber,
    maxAllowedTokenRateDeviationPerDay: BigNumber,
    tokenRate: BigNumber,
    blockTimestamp: BigNumber
) {
    const erc20BridgedPermit = await erc20BridgedPermitUnderProxy(
        deployer,
        erc20BridgedPermitName,
        erc20BridgedPermitSymbol,
        erc20BridgedPermitVersion,
        decimals,
        bridge
    );

    const tokenRateOracle = await tokenRateOracleUnderProxy(
        deployer,
        messenger,
        bridge,
        l1TokenRatePusher,
        tokenRateOutdatedDelay,
        maxAllowedL2ToL1ClockLag,
        maxAllowedTokenRateDeviationPerDay,
        tokenRate,
        BigNumber.from(blockTimestamp)
    )

    const erc20RebasableBridgedPermitImpl = await new ERC20RebasableBridgedPermit__factory(deployer).deploy(
        erc20RebasableBridgedPermitName,
        erc20RebasableBridgedPermitSymbol,
        erc20RebasableBridgedPermitVersion,
        decimals,
        erc20BridgedPermit.address,
        tokenRateOracle.address,
        bridge
    );

    const erc20RebasableBridgedPermitProxy = await new OssifiableProxy__factory(deployer).deploy(
        erc20RebasableBridgedPermitImpl.address,
        deployer.address,
        ERC20RebasableBridgedPermit__factory.createInterface().encodeFunctionData("initialize", [
            erc20RebasableBridgedPermitName,
            erc20RebasableBridgedPermitSymbol,
            erc20RebasableBridgedPermitVersion
        ])
    );

    const erc20RebasableBridgedPermit = ERC20RebasableBridgedPermit__factory.connect(
        erc20RebasableBridgedPermitProxy.address,
        deployer
    );

    return { tokenRateOracle, erc20BridgedPermit, erc20RebasableBridgedPermit };
}
