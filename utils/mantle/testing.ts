import { Signer } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

import {
  IERC20,
  ERC20Bridged,
  IERC20__factory,
  L1ERC20TokenBridge,
  L2ERC20TokenBridge,
  ERC20Bridged__factory,
  ERC20BridgedStub__factory,
  L1ERC20TokenBridge__factory,
  L2ERC20TokenBridge__factory,
  CrossDomainMessengerStub__factory,
} from "../../typechain";
import addresses from "./addresses";
import contracts from "./contracts";
import deployment from "./deployment";
import testingUtils from "../testing";
import { BridgingManagement } from "../bridging-management";
import network, { NetworkName, SignerOrProvider } from "../network";

export default function testing(networkName: NetworkName) {
  const mntAddresses = addresses(networkName);
  const ethMntNetworks = network.multichain(["eth", "mnt"], networkName);

  return {
    async getAcceptanceTestSetup() {
      const [ethProvider, mntProvider] = ethMntNetworks.getProviders({
        forking: true,
      });

      const bridgeContracts = await loadDeployedBridges(
        ethProvider,
        mntProvider
      );

      await printLoadedTestConfig(networkName, bridgeContracts);

      return {
        l1Provider: ethProvider,
        l2Provider: mntProvider,
        ...bridgeContracts,
      };
    },
    async getIntegrationTestSetup() {
      const hasDeployedContracts =
        testingUtils.env.USE_DEPLOYED_CONTRACTS(false);

      const [ethProvider, mntProvider] = ethMntNetworks.getProviders({
        forking: true,
      });

      const bridgeContracts = hasDeployedContracts
        ? await loadDeployedBridges(ethProvider, mntProvider)
        : await deployTestBridge(networkName, ethProvider, mntProvider);

      const [l1ERC20TokenBridgeAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l1ERC20TokenBridge);

      const [l2ERC20TokenBridgeAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l2ERC20TokenBridge);

      const l1TokensHolder = hasDeployedContracts
        ? await testingUtils.impersonate(
            testingUtils.env.L1_TOKENS_HOLDER(),
            ethProvider
          )
        : testingUtils.accounts.deployer(ethProvider);

      if (hasDeployedContracts) {
        await printLoadedTestConfig(
          networkName,
          bridgeContracts,
          l1TokensHolder
        );
      }

      // if the L1 bridge admin is a contract, remove it's code to
      // make it behave as EOA
      await ethProvider.send("hardhat_setCode", [
        l1ERC20TokenBridgeAdminAddress,
        "0x",
      ]);

      // same for the L2 bridge admin
      await mntProvider.send("hardhat_setCode", [
        l2ERC20TokenBridgeAdminAddress,
        "0x",
      ]);

      const mntContracts = contracts(networkName, { forking: true });

      return {
        l1Provider: ethProvider,
        l2Provider: mntProvider,
        l1TokensHolder,
        ...bridgeContracts,
        l1CrossDomainMessenger: mntContracts.L1CrossDomainMessengerStub,
        l2CrossDomainMessenger: mntContracts.L2CrossDomainMessenger,
        l1ERC20TokenBridgeAdmin: await testingUtils.impersonate(
          l1ERC20TokenBridgeAdminAddress,
          ethProvider
        ),
        l2ERC20TokenBridgeAdmin: await testingUtils.impersonate(
          l2ERC20TokenBridgeAdminAddress,
          mntProvider
        ),
        canonicalTransactionChain: mntContracts.CanonicalTransactionChain,
      };
    },
    async getE2ETestSetup() {
      const testerPrivateKey = testingUtils.env.TESTING_PRIVATE_KEY();
      const [ethProvider, mntProvider] = ethMntNetworks.getProviders({
        forking: false,
      });
      const [l1Tester, l2Tester] = ethMntNetworks.getSigners(testerPrivateKey, {
        forking: false,
      });

      const bridgeContracts = await loadDeployedBridges(l1Tester, l2Tester);

      await printLoadedTestConfig(networkName, bridgeContracts, l1Tester);

      return {
        l1Tester,
        l2Tester,
        l1Provider: ethProvider,
        l2Provider: mntProvider,
        ...bridgeContracts,
      };
    },
    async stubL1CrossChainMessengerContract() {
      const [ethProvider] = ethMntNetworks.getProviders({ forking: true });
      const deployer = testingUtils.accounts.deployer(ethProvider);
      const stub = await new CrossDomainMessengerStub__factory(
        deployer
      ).deploy();
      const stubBytecode = await ethProvider.send("eth_getCode", [
        stub.address,
      ]);

      await ethProvider.send("hardhat_setCode", [
        mntAddresses.L1CrossDomainMessenger,
        stubBytecode,
      ]);
    },
  };
}

async function loadDeployedBridges(
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  return {
    l1Token: IERC20__factory.connect(
      testingUtils.env.MNT_L1_TOKEN(),
      l1SignerOrProvider
    ),
    ...connectBridgeContracts(
      {
        l2Token: testingUtils.env.MNT_L2_TOKEN(),
        l1ERC20TokenBridge: testingUtils.env.MNT_L1_ERC20_TOKEN_BRIDGE(),
        l2ERC20TokenBridge: testingUtils.env.MNT_L2_ERC20_TOKEN_BRIDGE(),
      },
      l1SignerOrProvider,
      l2SignerOrProvider
    ),
  };
}

async function deployTestBridge(
  networkName: NetworkName,
  ethProvider: JsonRpcProvider,
  mntProvider: JsonRpcProvider
) {
  const ethDeployer = testingUtils.accounts.deployer(ethProvider);
  const mntDeployer = testingUtils.accounts.deployer(mntProvider);

  const l1Token = await new ERC20BridgedStub__factory(ethDeployer).deploy(
    "Test Token",
    "TT"
  );

  const [ethDeployScript, mntDeployScript] = await deployment(
    networkName
  ).erc20TokenBridgeDeployScript(
    l1Token.address,
    {
      deployer: ethDeployer,
      admins: { proxy: ethDeployer.address, bridge: ethDeployer.address },
    },
    {
      deployer: mntDeployer,
      admins: { proxy: mntDeployer.address, bridge: mntDeployer.address },
    }
  );

  await ethDeployScript.run();
  await mntDeployScript.run();

  const l1ERC20TokenBridgeProxyDeployStepIndex = 1;
  const l1BridgingManagement = new BridgingManagement(
    ethDeployScript.getContractAddress(l1ERC20TokenBridgeProxyDeployStepIndex),
    ethDeployer
  );

  const l2ERC20TokenBridgeProxyDeployStepIndex = 3;
  const l2BridgingManagement = new BridgingManagement(
    mntDeployScript.getContractAddress(l2ERC20TokenBridgeProxyDeployStepIndex),
    mntDeployer
  );

  await l1BridgingManagement.setup({
    bridgeAdmin: ethDeployer.address,
    depositsEnabled: true,
    withdrawalsEnabled: true,
  });

  await l2BridgingManagement.setup({
    bridgeAdmin: mntDeployer.address,
    depositsEnabled: true,
    withdrawalsEnabled: true,
  });

  return {
    l1Token: l1Token.connect(ethProvider),
    ...connectBridgeContracts(
      {
        l2Token: mntDeployScript.getContractAddress(1),
        l1ERC20TokenBridge: ethDeployScript.getContractAddress(1),
        l2ERC20TokenBridge: mntDeployScript.getContractAddress(3),
      },
      ethProvider,
      mntProvider
    ),
  };
}

function connectBridgeContracts(
  addresses: {
    l2Token: string;
    l1ERC20TokenBridge: string;
    l2ERC20TokenBridge: string;
  },
  ethSignerOrProvider: SignerOrProvider,
  mntSignerOrProvider: SignerOrProvider
) {
  const l1ERC20TokenBridge = L1ERC20TokenBridge__factory.connect(
    addresses.l1ERC20TokenBridge,
    ethSignerOrProvider
  );
  const l2ERC20TokenBridge = L2ERC20TokenBridge__factory.connect(
    addresses.l2ERC20TokenBridge,
    mntSignerOrProvider
  );
  const l2Token = ERC20Bridged__factory.connect(
    addresses.l2Token,
    mntSignerOrProvider
  );
  return {
    l2Token,
    l1ERC20TokenBridge,
    l2ERC20TokenBridge,
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
    "In case of unexpected fails, please, make sure that you are forking correct Ethereum/Mantle networks"
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
