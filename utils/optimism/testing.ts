import { Signer } from "ethers";
import network, { NetworkName, SignerOrProvider } from "../network";
import {
  CrossDomainMessengerStub__factory,
  ERC20Bridged,
  ERC20BridgedStub__factory,
  ERC20Bridged__factory,
  IERC20,
  IERC20__factory,
  L1ERC20TokenBridge,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge,
  L2ERC20TokenBridge__factory,
} from "../../typechain";
import addresses from "./addresses";
import contracts from "./contracts";
import testingUtils from "../testing";
import { BridgingManagement } from "../bridging-management";
import deployment from "./deployment";

export default function testing(networkName: NetworkName) {
  const optAddresses = addresses(networkName);
  const optContracts = contracts(networkName);

  return {
    async getAcceptanceTestSetup() {
      const [l1Provider, l2Provider] = network.getMultiChainProvider(
        "optimism",
        networkName
      );

      const bridgeContracts = await loadDeployedBridges(l1Provider, l2Provider);

      await printLoadedTestConfig(networkName, bridgeContracts);

      return {
        l1Provider,
        l2Provider,
        ...bridgeContracts,
      };
    },
    async getIntegrationTestSetup() {
      const hasDeployedContracts =
        testingUtils.env.USE_DEPLOYED_CONTRACTS(false);
      const [l1Provider, l2Provider] = network.getMultiChainProvider(
        "optimism",
        networkName
      );
      const bridgeContracts = hasDeployedContracts
        ? await loadDeployedBridges(l1Provider, l2Provider)
        : await deployTestBridge(networkName);

      const [l1ERC20TokenBridgeAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l1ERC20TokenBridge);

      const [l2ERC20TokenBridgeAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l2ERC20TokenBridge);

      const l1TokensHolder = hasDeployedContracts
        ? await testingUtils.impersonate(
            testingUtils.env.L1_TOKENS_HOLDER(),
            l1Provider
          )
        : testingUtils.accounts.deployer(l1Provider);

      if (hasDeployedContracts) {
        await printLoadedTestConfig(
          networkName,
          bridgeContracts,
          l1TokensHolder
        );
      }

      return {
        l1Provider,
        l2Provider,
        l1TokensHolder,
        ...bridgeContracts,
        l1CrossDomainMessenger: optContracts.L1CrossDomainMessengerStub,
        l2CrossDomainMessenger: optContracts.L2CrossDomainMessenger,
        l1ERC20TokenBridgeAdmin: await testingUtils.impersonate(
          l1ERC20TokenBridgeAdminAddress,
          l1Provider
        ),
        l2ERC20TokenBridgeAdmin: await testingUtils.impersonate(
          l2ERC20TokenBridgeAdminAddress,
          l2Provider
        ),
        canonicalTransactionChain: optContracts.CanonicalTransactionChain,
      };
    },
    async getE2ETestSetup() {
      const testerPrivateKey = testingUtils.env.TESTING_PRIVATE_KEY();
      const [l1Tester, l2Tester] = network.getMultiChainSigner(
        "optimism",
        networkName,
        testerPrivateKey
      );
      const [l1Provider, l2Provider] = network.getMultiChainProvider(
        "optimism",
        networkName
      );

      const bridgeContracts = await loadDeployedBridges(l1Tester, l2Tester);

      await printLoadedTestConfig(networkName, bridgeContracts, l1Tester);

      return {
        l1Tester,
        l2Tester,
        l1Provider,
        l2Provider,
        ...bridgeContracts,
      };
    },
    async stubL1CrossChainMessengerContract() {
      const [l1Provider] = network.getMultiChainProvider(
        "optimism",
        networkName
      );
      const deployer = testingUtils.accounts.deployer(l1Provider);
      const stub = await new CrossDomainMessengerStub__factory(
        deployer
      ).deploy();
      const stubBytecode = await l1Provider.send("eth_getCode", [stub.address]);

      await l1Provider.send("hardhat_setCode", [
        optAddresses.L1CrossDomainMessenger,
        stubBytecode,
      ]);
    },
  };
}

function connectBridgeContracts(
  addresses: {
    l2Token: string;
    l1ERC20TokenBridge: string;
    l2ERC20TokenBridge: string;
  },
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  const l1ERC20TokenBridge = L1ERC20TokenBridge__factory.connect(
    addresses.l1ERC20TokenBridge,
    l1SignerOrProvider
  );
  const l2ERC20TokenBridge = L2ERC20TokenBridge__factory.connect(
    addresses.l2ERC20TokenBridge,
    l2SignerOrProvider
  );
  const l2Token = ERC20Bridged__factory.connect(
    addresses.l2Token,
    l2SignerOrProvider
  );
  return {
    l2Token,
    l1ERC20TokenBridge,
    l2ERC20TokenBridge,
  };
}

async function loadDeployedBridges(
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  return {
    l1Token: IERC20__factory.connect(
      testingUtils.env.OPT_L1_TOKEN(),
      l1SignerOrProvider
    ),
    ...connectBridgeContracts(
      {
        l2Token: testingUtils.env.OPT_L2_TOKEN(),
        l1ERC20TokenBridge: testingUtils.env.OPT_L1_ERC20_TOKEN_BRIDGE(),
        l2ERC20TokenBridge: testingUtils.env.OPT_L2_ERC20_TOKEN_BRIDGE(),
      },
      l1SignerOrProvider,
      l2SignerOrProvider
    ),
  };
}

async function deployTestBridge(networkName: NetworkName) {
  const [l1Provider, l2Provider] = network.getMultiChainProvider(
    "optimism",
    networkName
  );

  const l1Deployer = testingUtils.accounts.deployer(l1Provider);
  const l2Deployer = testingUtils.accounts.deployer(l2Provider);

  const l1Token = await new ERC20BridgedStub__factory(l1Deployer).deploy(
    "Test Token",
    "TT"
  );

  const [l1DeployScript, l2DeployScript] = await deployment(
    networkName
  ).erc20TokenBridgeDeployScript(
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
    ...connectBridgeContracts(
      {
        l2Token: l2DeployScript.getContractAddress(1),
        l1ERC20TokenBridge: l1DeployScript.getContractAddress(1),
        l2ERC20TokenBridge: l2DeployScript.getContractAddress(3),
      },
      l1Provider,
      l2Provider
    ),
  };
}

async function printLoadedTestConfig(
  networkName: NetworkName,
  bridgeContracts: {
    l1Token: IERC20;
    l2Token: ERC20Bridged;
    l1ERC20TokenBridge: L1ERC20TokenBridge;
    l2ERC20TokenBridge: L2ERC20TokenBridge;
  },
  l1TokensHolder?: Signer
) {
  console.log("Using the deployed contracts for testing");
  console.log(
    "In case of unexpected fails, please, make sure that you are forking correct Ethereum/Optimism networks"
  );
  console.log(`  · Network Name: ${networkName}`);
  console.log(`  · L1 Token: ${bridgeContracts.l1Token.address}`);
  console.log(`  · L2 Token: ${bridgeContracts.l2Token.address}`);
  if (l1TokensHolder) {
    const l1TokensHolderAddress = await l1TokensHolder.getAddress();
    console.log(`  · L1 Tokens Holder: ${l1TokensHolderAddress}`);
    const holderBalance = await bridgeContracts.l1Token.balanceOf(
      l1TokensHolderAddress
    );
    console.log(`  · L1 Tokens Holder Balance: ${holderBalance.toString()}`);
  }
  console.log(
    `  · L1 ERC20 Token Bridge: ${bridgeContracts.l1ERC20TokenBridge.address}`
  );
  console.log(
    `  · L2 ERC20 Token Bridge: ${bridgeContracts.l2ERC20TokenBridge.address}`
  );
  console.log();
}
