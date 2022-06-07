import { assert } from "chai";
import { Wallet } from "ethers";
import {
  ERC20Ownable__factory,
  IERC20Metadata__factory,
  L1TokenBridge__factory,
  L2TokenBridge__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { DeployScript } from "./DeployScript";
import { predictAddresses } from "./network";

interface OptimismCommonDependencies {
  messenger: string;
}

interface OptimismL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface OptimismL2DeployScriptParams extends OptimismL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

const OPT_L1_DEPENDENCIES: Record<number, OptimismCommonDependencies> = {
  1: { messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1" },
  17: { messenger: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
  42: { messenger: "0x4361d0F75A0186C05f971c566dC6bEa5957483fD" },
  31337: { messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1" },
};

const OPT_L2_DEPENDENCIES: Record<number, OptimismCommonDependencies> = {
  1: { messenger: "0x4200000000000000000000000000000000000007" },
  10: { messenger: "0x4200000000000000000000000000000000000007" },
  42: { messenger: "0x4200000000000000000000000000000000000007" },
  69: { messenger: "0x4200000000000000000000000000000000000007" },
  31337: { messenger: "0x4200000000000000000000000000000000000007" },
};

export async function createOptimismBridgeDeployScripts(
  l1Token: string,
  l1Params: OptimismL1DeployScriptParams,
  l2Params: OptimismL2DeployScriptParams
) {
  const l1Dependencies = loadOptimismL1Dependencies(
    await l1Params.deployer.getChainId()
  );
  const l2Dependencies = loadOptimismL2Dependencies(
    await l2Params.deployer.getChainId()
  );

  const [expectedL1TokenBridgeImplAddress, expectedL1TokenBridgeProxyAddress] =
    await predictAddresses(l1Params.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokenBridgeImplAddress,
    expectedL2TokenBridgeProxyAddress,
  ] = await predictAddresses(l2Params.deployer, 4);

  const l1DeployScript = new DeployScript(l1Params.deployer)
    .addStep({
      factory: L1TokenBridge__factory,
      args: [
        l1Dependencies.messenger,
        expectedL2TokenBridgeProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokenBridgeImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL1TokenBridgeImplAddress,
        l1Params.admins.proxy,
        L1TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [l1Params.admins.bridge]
        ),
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokenBridgeProxyAddress),
    });

  const l1TokenInfo = IERC20Metadata__factory.connect(
    l1Token,
    l1Params.deployer
  );

  const [decimals, l2TokenName, l2TokenSymbol] = await Promise.all([
    l1TokenInfo.decimals(),
    l2Params.l2Token?.name ?? l1TokenInfo.name(),
    l2Params.l2Token?.symbol ?? l1TokenInfo.symbol(),
  ]);

  const l2DeployScript = new DeployScript(l2Params.deployer)
    .addStep({
      factory: ERC20Ownable__factory,
      args: [
        l2TokenName,
        l2TokenSymbol,
        decimals,
        expectedL2TokenBridgeProxyAddress,
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [expectedL2TokenImplAddress, l2Params.admins.proxy, "0x"],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenProxyAddress),
    })
    .addStep({
      factory: L2TokenBridge__factory,
      args: [
        l2Dependencies.messenger,
        expectedL1TokenBridgeProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL2TokenBridgeImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenBridgeImplAddress,
        l2Params.admins.proxy,
        L2TokenBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2Params.admins.bridge]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

function loadOptimismL1Dependencies(chainId: number) {
  const dependencies = OPT_L1_DEPENDENCIES[chainId];
  if (!dependencies) {
    throw new Error(`Dependencies for chain id ${chainId} are not declared`);
  }
  return dependencies;
}

function loadOptimismL2Dependencies(chainId: number) {
  const dependencies = OPT_L2_DEPENDENCIES[chainId];
  if (!dependencies) {
    throw new Error(`Dependencies for chain id ${chainId} are not declared`);
  }
  return dependencies;
}
