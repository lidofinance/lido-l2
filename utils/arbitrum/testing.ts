import {
  IERC20__factory,
  ERC20BridgedStub__factory,
  L1ERC20TokenGateway__factory,
  L2ERC20TokenGateway__factory,
  ArbSysStub__factory,
  ERC20Bridged__factory,
} from "../../typechain";
import testing from "../testing";
import arbitrum from "../arbitrum";
import { BridgingManagement } from "../bridging-management";
import network, { NetworkName, SignerOrProvider } from "../network";

export default {
  async getAcceptanceTestSetup(networkName: NetworkName) {
    const [l1Provider, l2Provider] = network.getMultiChainProvider(
      "arbitrum",
      networkName
    );
    const gatewayContracts = await loadDeployedGateways(l1Provider, l2Provider);

    const gatewayRouterAddresses = arbitrum.addresses(networkName, {
      L1GatewayRouter: testing.env.ARB_L1_GATEWAY_ROUTER(
        arbitrum.addresses(networkName).L1GatewayRouter
      ),
      L2GatewayRouter: testing.env.ARB_L2_GATEWAY_ROUTER(
        arbitrum.addresses(networkName).L2GatewayRouter
      ),
    });

    const arbContracts = arbitrum.addresses(
      networkName,
      gatewayRouterAddresses
    );

    return {
      l1Provider,
      l2Provider,
      ...gatewayContracts,
      arbSys: arbitrum.contracts(networkName).ArbSys,
      ...connectGatewayRouters(networkName, arbContracts),
    };
  },
  async getIntegrationTestSetup(networkName: NetworkName) {
    const hasDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);

    const [l1Provider, l2Provider] = network.getMultiChainProvider(
      "arbitrum",
      networkName
    );

    const gatewayContracts = hasDeployedContracts
      ? await loadDeployedGateways(l1Provider, l2Provider)
      : await deployTestGateway(networkName);

    const [l1ERC20TokenGatewayAdminAddress] =
      await BridgingManagement.getAdmins(gatewayContracts.l1ERC20TokenGateway);

    const [l2ERC20TokenGatewayAdminAddress] =
      await BridgingManagement.getAdmins(gatewayContracts.l2ERC20TokenGateway);

    const gatewayRouterAddresses = arbitrum.addresses(networkName, {
      L1GatewayRouter: hasDeployedContracts
        ? testing.env.ARB_L1_GATEWAY_ROUTER(
            arbitrum.addresses(networkName).L1GatewayRouter
          )
        : undefined,
      L2GatewayRouter: hasDeployedContracts
        ? testing.env.ARB_L2_GATEWAY_ROUTER(
            arbitrum.addresses(networkName).L2GatewayRouter
          )
        : undefined,
    });

    const arbContracts = arbitrum.addresses(
      networkName,
      gatewayRouterAddresses
    );

    const gatewayRouters = connectGatewayRouters(networkName, arbContracts);

    const l1TokensHolder = hasDeployedContracts
      ? await testing.impersonate(testing.env.L1_TOKENS_HOLDER(), l1Provider)
      : testing.accounts.deployer(l1Provider);

    if (hasDeployedContracts) {
      await printLoadedTestConfig(
        networkName,
        l1TokensHolder,
        gatewayContracts,
        gatewayRouters
      );
    }

    return {
      l1Provider,
      l2Provider,
      l1TokensHolder,
      ...gatewayContracts,
      arbSys: arbitrum.contracts(networkName).ArbSys,
      ...gatewayRouters,
      l1ERC20TokenGatewayAdmin: await testing.impersonate(
        l1ERC20TokenGatewayAdminAddress,
        l1Provider
      ),
      l2ERC20TokenGatewayAdmin: await testing.impersonate(
        l2ERC20TokenGatewayAdminAddress,
        l2Provider
      ),
    };
  },
  async getE2ETestSetup(networkName: NetworkName) {
    const testerPrivateKey = testing.env.TESTING_PRIVATE_KEY();
    const [l1Tester, l2Tester] = network.getMultiChainSigner(
      "arbitrum",
      networkName,
      testerPrivateKey
    );
    const [l1Provider, l2Provider] = network.getMultiChainProvider(
      "arbitrum",
      networkName
    );

    const arbAddresses = arbitrum.addresses(networkName);

    const gatewayRouterAddresses = {
      L1GatewayRouter: testing.env.ARB_L1_GATEWAY_ROUTER(
        arbAddresses.L1GatewayRouter
      ),
      L2GatewayRouter: testing.env.ARB_L2_GATEWAY_ROUTER(
        arbAddresses.L2GatewayRouter
      ),
    };

    const gatewayContracts = await loadDeployedGateways(l1Tester, l2Tester);

    const gatewayRouters = connectGatewayRouters(
      networkName,
      gatewayRouterAddresses
    );

    await printLoadedTestConfig(
      networkName,
      l1Tester,
      gatewayContracts,
      gatewayRouters
    );

    return {
      l1Tester,
      l2Tester,
      l1Provider,
      l2Provider,
      ...gatewayContracts,
      ...gatewayRouters,
    };
  },
  async stubArbSysContract(networkName: NetworkName) {
    const [, l2Provider] = network.getMultiChainProvider(
      "arbitrum",
      networkName
    );
    const deployer = testing.accounts.deployer(l2Provider);
    const stub = await new ArbSysStub__factory(deployer).deploy();
    const stubBytecode = await l2Provider.send("eth_getCode", [stub.address]);

    await l2Provider.send("hardhat_setCode", [
      arbitrum.addresses(networkName).ArbSys,
      stubBytecode,
    ]);
  },
};

async function deployTestGateway(networkName: NetworkName) {
  const [l1Provider, l2Provider] = network.getMultiChainProvider(
    "arbitrum",
    networkName
  );

  const l1Deployer = testing.accounts.deployer(l1Provider);
  const l2Deployer = testing.accounts.deployer(l2Provider);

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );

  const [l1DeployScript, l2DeployScript] = await arbitrum.deployment
    .erc20TokenGateways(networkName)
    .createDeployScripts(
      l1Token.address,
      {
        deployer: l1Deployer,
        admins: { proxy: l1Deployer.address, bridge: l1Deployer.address },
      },
      {
        deployer: l2Deployer,
        admins: { proxy: l2Deployer.address, bridge: l2Deployer.address },
      }
    );

  await l1DeployScript.run();
  await l2DeployScript.run();

  return {
    l1Token: l1Token.connect(l1Provider),
    ...connectGatewayContracts(
      {
        l2Token: l2DeployScript.getContractAddress(1),
        l1ERC20TokenGateway: l1DeployScript.getContractAddress(1),
        l2ERC20TokenGateway: l2DeployScript.getContractAddress(3),
      },
      l1Provider,
      l2Provider
    ),
  };
}

async function loadDeployedGateways(
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  return {
    l1Token: IERC20__factory.connect(
      testing.env.ARB_L1_TOKEN(),
      l1SignerOrProvider
    ),
    ...connectGatewayContracts(
      {
        l2Token: testing.env.ARB_L2_TOKEN(),
        l1ERC20TokenGateway: testing.env.ARB_L1_ERC20_TOKEN_GATEWAY(),
        l2ERC20TokenGateway: testing.env.ARB_L2_ERC20_TOKEN_GATEWAY(),
      },
      l1SignerOrProvider,
      l2SignerOrProvider
    ),
  };
}

function connectGatewayRouters(
  networkName: NetworkName,
  addresses: {
    L1GatewayRouter: string;
    L2GatewayRouter: string;
  }
) {
  const arbContracts = arbitrum.contracts(networkName, addresses);
  return {
    l1GatewayRouter: arbContracts.L1GatewayRouter,
    l2GatewayRouter: arbContracts.L2GatewayRouter,
  };
}

function connectGatewayContracts(
  addresses: {
    l2Token: string;
    l1ERC20TokenGateway: string;
    l2ERC20TokenGateway: string;
  },
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  const l1ERC20TokenGateway = L1ERC20TokenGateway__factory.connect(
    addresses.l1ERC20TokenGateway,
    l1SignerOrProvider
  );
  const l2ERC20TokenGateway = L2ERC20TokenGateway__factory.connect(
    addresses.l2ERC20TokenGateway,
    l2SignerOrProvider
  );
  const l2Token = ERC20Bridged__factory.connect(
    addresses.l2Token,
    l2SignerOrProvider
  );
  return {
    l2Token,
    l1ERC20TokenGateway,
    l2ERC20TokenGateway,
  };
}

async function printLoadedTestConfig(
  networkName: NetworkName,
  l1TokensHolder: any,
  gatewayContracts: any,
  gatewayRouters: any
) {
  console.log("Using the deployed contracts for integration tests");
  console.log(
    "In case of unexpected fails, please, make sure that you are forking correct Ethereum/Arbitrum networks"
  );
  console.log(`  Network Name: ${networkName}`);
  console.log(`  L1 Token: ${gatewayContracts.l1Token.address}`);
  console.log(`  L2 Token: ${gatewayContracts.l2Token.address}`);
  const l1TokensHolderAddress = await l1TokensHolder.getAddress();
  console.log(`  L1 Tokens Holder: ${l1TokensHolderAddress}`);
  const holderBalance = await gatewayContracts.l1Token.balanceOf(
    l1TokensHolderAddress
  );
  console.log(`  L1 Tokens Holder Balance: ${holderBalance.toString()}`);
  console.log(
    `  L1 ERC20 Token Gateway: ${gatewayContracts.l1ERC20TokenGateway.address}`
  );
  console.log(
    `  L2 ERC20 Token Gateway: ${gatewayContracts.l2ERC20TokenGateway.address}`
  );
  console.log(`  L1 Gateway Router: ${gatewayRouters.l1GatewayRouter.address}`);
  console.log(
    `  L2 Gateway Routery: ${gatewayRouters.l2GatewayRouter.address}`
  );
}
