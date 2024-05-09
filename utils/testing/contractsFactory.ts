import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    ERC20BridgedPermit__factory,
    TokenRateOracle__factory,
    ERC20RebasableBridgedPermit__factory,
    OssifiableProxy__factory,
    TokenRateOracle,
    ERC20BridgedPermit
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

    return ERC20BridgedPermit__factory.connect(
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
    return TokenRateOracle__factory.connect(
        tokenRateOracleProxy.address,
        deployer
    );
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
        18,
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
