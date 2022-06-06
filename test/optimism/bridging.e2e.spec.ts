import hre from "hardhat";
import {
  ERC20Ownable,
  ERC20Ownable__factory,
  ERC20Stub,
  ERC20Stub__factory,
  L1TokenBridge,
  L1TokenBridge__factory,
  L2TokenBridge,
  L2TokenBridge__factory,
} from "../../typechain";
import { loadOptimismDeployDependencies } from "../../utils/deployment/dependencies";
import { createOptimismBridgeDeployScripts } from "../../utils/deployment/script-factories";
import {
  DeploymentNetwork,
  getDeploymentNetwork,
} from "../../utils/deployment/network";
import { wei } from "../../utils/wei";
import { assert } from "chai";
import {
  CrossChainMessenger,
  MessageStatus,
  DAIBridgeAdapter,
} from "@eth-optimism/sdk";

describe("Optimism :: bridging integration test", () => {
  let network: DeploymentNetwork;
  let l1Token: ERC20Stub;
  let l1TokenBridge: L1TokenBridge;
  let l2TokenBridge: L2TokenBridge;
  let l2Token: ERC20Ownable;
  before(async () => {
    network = getDeploymentNetwork(hre);
    const dependencies = await loadOptimismDeployDependencies(network);

    // deploy L1Token stub
    l1Token = await new ERC20Stub__factory(network.l1.deployer).deploy(
      "L1 Token",
      "L1"
    );

    const [l1DeployScript, l2DeployScript] =
      await createOptimismBridgeDeployScripts(
        network,
        dependencies,
        l1Token.address
      );
    const l1Contracts = await l1DeployScript.run();
    const l2Contracts = await l2DeployScript.run();

    l1TokenBridge = L1TokenBridge__factory.connect(
      l1Contracts[1].address,
      network.l1.deployer
    );
    l2Token = ERC20Ownable__factory.connect(
      l2Contracts[1].address,
      network.l2.deployer
    );
    l2TokenBridge = L2TokenBridge__factory.connect(
      l2Contracts[3].address,
      network.l2.deployer
    );

    // initialize token bridge

    const roles = await Promise.all([
      l1TokenBridge.DEPOSITS_ENABLER_ROLE(),
      l1TokenBridge.DEPOSITS_DISABLER_ROLE(),
      l1TokenBridge.WITHDRAWALS_ENABLER_ROLE(),
      l1TokenBridge.WITHDRAWALS_DISABLER_ROLE(),
    ]);

    for (const role of roles) {
      await l1TokenBridge.grantRole(role, network.l1.deployer.address);
      await l2TokenBridge.grantRole(role, network.l2.deployer.address);
    }
    await l1TokenBridge.enableDeposits();
    await l1TokenBridge.enableWithdrawals();
    await l2TokenBridge.enableDeposits();
    await l2TokenBridge.enableWithdrawals();

    assert.isTrue(await l1TokenBridge.isDepositsEnabled());
    assert.isTrue(await l1TokenBridge.isWithdrawalsEnabled());
    assert.isTrue(await l2TokenBridge.isDepositsEnabled());
    assert.isTrue(await l2TokenBridge.isWithdrawalsEnabled());
  });
  it("depositERC20() -> finalizeDeposit()", async () => {
    console.log("Run");
    const amount = wei`1 ether`;
    // approve tokens before transfer
    await l1Token.approve(l1TokenBridge.address, amount);

    console.log(
      "L1Token balance:",
      await l1Token.balanceOf(network.l1.deployer.address)
    );

    console.log(
      "L1Token allowance:",
      await l1Token.allowance(
        network.l1.deployer.address,
        l1TokenBridge.address
      )
    );

    console.log(
      "L2Token balance:",
      await l2Token.balanceOf(network.l2.deployer.address)
    );

    console.log("l1TokenBridge.messenger()", await l1TokenBridge.messenger());
    console.log("l1TokenBridge.l1Token()", await l1TokenBridge.l1Token());
    console.log("l1TokenBridge.l2Token()", await l1TokenBridge.l2Token());
    console.log(
      "l1TokenBridge.l2TokenBridge()",
      await l1TokenBridge.l2TokenBridge()
    );

    const crossChainMessenger = new CrossChainMessenger({
      l1ChainId: await network.l1.deployer.getChainId(), // For Kovan, it's 1 for Mainnet
      l1SignerOrProvider: network.l1.deployer,
      l2SignerOrProvider: network.l2.deployer,
      contracts: {
        l1: {
          L1CrossDomainMessenger: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
          AddressManager: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          CanonicalTransactionChain:
            "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
          // ChugSplashDictator: "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1",
          BondManager: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
          // Lib_AddressManager: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          L1StandardBridge: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
          StateCommitmentChain: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
        },
        // l2: DEFAULT_L2_CONTRACT_ADDRESSES,
      },
      bridges: {
        LidoBridge: {
          Adapter: DAIBridgeAdapter,
          l1Bridge: l1TokenBridge.address,
          l2Bridge: l2TokenBridge.address,
        },
      },
    });

    const allowanceResponse = await crossChainMessenger.approveERC20(
      l1Token.address,
      l2Token.address,
      amount
    );
    await allowanceResponse.wait();
    console.log(`Allowance given by tx ${allowanceResponse.hash}`);

    const depositResponse = await crossChainMessenger.depositERC20(
      l1Token.address,
      l2Token.address,
      amount
    );
    console.log(`Deposit transaction hash (on L1): ${depositResponse.hash}`);
    await depositResponse.wait();
    console.log("Waiting for status to change to RELAYED");
    await crossChainMessenger.waitForMessageStatus(
      depositResponse.hash,
      MessageStatus.RELAYED
    );

    const withdrawalResponse = await crossChainMessenger.withdrawERC20(
      l1Token.address,
      l2Token.address,
      amount
    );
    console.log(`Transaction hash (on L2): ${depositResponse.hash}`);
    await depositResponse.wait();

    await crossChainMessenger.waitForMessageStatus(
      withdrawalResponse.hash,
      MessageStatus.READY_FOR_RELAY
    );
    console.log("Ready for relay, finalizing message now");
    await crossChainMessenger.finalizeMessage(withdrawalResponse);
    console.log("Waiting for status to change to RELAYED");
  });
});
