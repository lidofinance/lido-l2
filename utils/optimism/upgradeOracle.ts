import {
  OssifiableProxy__factory,
  OptimismBridgeExecutor__factory
} from "../../typechain";

import network, { NetworkName } from "../network";
import testingUtils from "../testing";
import contracts from "./contracts";
import testing from "../../utils/testing";
import optimism from "../../utils/optimism";
import { getBridgeExecutorParams } from "../../utils/bridge-executor";

export async function upgradeOracle(
    networkName: NetworkName,
    oracleProxyAddress: string,
    newOracleAddress: string
  ) {
    const ethOptNetworks = network.multichain(["eth", "opt"], networkName);
    const [
        ethProvider,
        optProvider
    ] = ethOptNetworks.getProviders({ forking: true });
    const ethDeployer = testing.accounts.deployer(ethProvider);
    const optDeployer = testing.accounts.deployer(optProvider);


    const optContracts = contracts(networkName, { forking: true });
    const l1CrossDomainMessengerAliased = await testingUtils.impersonate(
      testingUtils.accounts.applyL1ToL2Alias(optContracts.L1CrossDomainMessenger.address),
      optProvider
    );
    const l2CrossDomainMessenger = await optContracts.L2CrossDomainMessenger.connect(
        l1CrossDomainMessengerAliased
    );


    const testingOnDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);
    const optAddresses = optimism.addresses(networkName);
    const govBridgeExecutor = testingOnDeployedContracts
    ? OptimismBridgeExecutor__factory.connect(
        testing.env.OPT_GOV_BRIDGE_EXECUTOR(),
        optProvider
    )
    : await new OptimismBridgeExecutor__factory(optDeployer).deploy(
        optAddresses.L2CrossDomainMessenger,
        ethDeployer.address,
        ...getBridgeExecutorParams(),
        optDeployer.address
    );


    const l1EthGovExecutorAddress = await govBridgeExecutor.getEthereumGovernanceExecutor();
    const bridgeExecutor = govBridgeExecutor.connect(optDeployer);
    const l2OracleProxy = OssifiableProxy__factory.connect(
      oracleProxyAddress,
      optDeployer
    );

    await l2CrossDomainMessenger.relayMessage(
      0,
      l1EthGovExecutorAddress,
      bridgeExecutor.address,
      0,
      300_000,
      bridgeExecutor.interface.encodeFunctionData("queue", [
        [oracleProxyAddress],
        [0],
        ["proxy__upgradeTo(address)"],
        [
          "0x" +
          l2OracleProxy.interface
              .encodeFunctionData("proxy__upgradeTo", [newOracleAddress])
              .substring(10),
        ],
        [false],
      ]),
      { gasLimit: 5_000_000 }
    );
}
