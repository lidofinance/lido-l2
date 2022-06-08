import { assert } from "chai";
import { Wallet } from "ethers";
import {
  ERC20Ownable__factory,
  IERC20Metadata__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { DeployScript } from "../../utils/deployment/DeployScript";
import { predictAddresses } from "../../utils/deployment/network";

interface ArbitrumL1DeployScriptParams {
  deployer: Wallet;
  admins: { proxy: string; bridge: string };
}

interface ArbitrumL2DeployScriptParams extends ArbitrumL1DeployScriptParams {
  l2Token?: { name?: string; symbol?: string };
}

interface L1ArbitrumDependencies {
  inbox: string;
  router: string;
}

interface L2ArbitrumDependencies {
  arbSys: string;
  router: string;
}

const L1_DEPENDENCIES: Record<number, L1ArbitrumDependencies> = {
  1: {
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    router: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  },
  4: {
    inbox: "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e",
    router: "0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380",
  },
  31337: {
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    router: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
  },
};

const L2_DEPENDENCIES: Record<number, L2ArbitrumDependencies> = {
  42161: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
  },
  421611: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
  },
  31337: {
    arbSys: "0x0000000000000000000000000000000000000064",
    router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
  },
};

export async function createArbitrumGatewayDeployScripts(
  l1Token: string,
  l1Params: ArbitrumL1DeployScriptParams,
  l2Params: ArbitrumL2DeployScriptParams
) {
  const l1Dependencies = loadArbitrumL1Dependencies(
    await l1Params.deployer.getChainId()
  );
  const l2Dependencies = loadArbitrumL2Dependencies(
    await l2Params.deployer.getChainId()
  );

  const [
    expectedL1TokensGatewayImplAddress,
    expectedL1TokensGatewayProxyAddress,
  ] = await predictAddresses(l1Params.deployer, 2);

  const [
    expectedL2TokenImplAddress,
    expectedL2TokenProxyAddress,
    expectedL2TokensGatewayImplAddress,
    expectedL2TokensGatewayProxyAddress,
  ] = await predictAddresses(l2Params.deployer, 4);

  const l1DeployScript = new DeployScript(l1Params.deployer)
    .addStep({
      factory: L1ERC20TokenGateway__factory,
      args: [
        l1Dependencies.inbox,
        l1Dependencies.router,
        expectedL2TokensGatewayProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokensGatewayImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL1TokensGatewayImplAddress,
        l1Params.admins.proxy,
        L1ERC20TokenGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [l1Params.admins.bridge]
        ),
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL1TokensGatewayProxyAddress),
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
        expectedL2TokensGatewayProxyAddress,
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokenImplAddress,
        l2Params.admins.proxy,
        ERC20Ownable__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2TokenName, l2TokenSymbol]
        ),
      ],
      afterDeploy: (c) => assert.equal(c.address, expectedL2TokenProxyAddress),
    })
    .addStep({
      factory: L2ERC20TokenGateway__factory,
      args: [
        l2Dependencies.arbSys,
        l2Dependencies.router,
        expectedL1TokensGatewayProxyAddress,
        l1Token,
        expectedL2TokenProxyAddress,
      ],
      afterDeploy: (c) =>
        assert.equal(c.address, expectedL2TokensGatewayImplAddress),
    })
    .addStep({
      factory: OssifiableProxy__factory,
      args: [
        expectedL2TokensGatewayImplAddress,
        l2Params.admins.proxy,
        L2ERC20TokenGateway__factory.createInterface().encodeFunctionData(
          "initialize",
          [l2Params.admins.bridge]
        ),
      ],
    });

  return [l1DeployScript, l2DeployScript];
}

function loadArbitrumL1Dependencies(chainId: number) {
  const dependencies = L1_DEPENDENCIES[chainId];
  if (!dependencies) {
    throw new Error(`Dependencies for chain id ${chainId} are not declared`);
  }

  return dependencies;
}

function loadArbitrumL2Dependencies(chainId: number) {
  const dependencies = L2_DEPENDENCIES[chainId];
  if (!dependencies) {
    throw new Error(`Dependencies for chain id ${chainId} are not declared`);
  }

  return dependencies;
}
