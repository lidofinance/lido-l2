import hre, { ethers } from "hardhat";
import { assert } from "chai";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import {
  ERC20Ownable,
  ERC20Ownable__factory,
  ERC20Stub,
  ERC20Stub__factory,
  L1TokenBridge,
  L1TokenBridge__factory,
  L2TokenBridge,
  L2TokenBridge__factory,
  CrossDomainMessengerStub,
  AddressAliasHelper,
} from "../../typechain";
import {
  createOptimismBridgeDeployScripts,
  OPT_L2_DEPENDENCIES,
} from "../../utils/deployment/optimism";
import { wei } from "../../utils/wei";
import { getDeployer } from "../../utils/deployment/network";
import CrossDomainMessengerABI from "../../abi/CrossDomainMessenger";
import L2TokenBridgeABI from "../../abi/L2TokenBridge";

describe("Optimism :: bridging integration test", () => {
  let l1Deployer: Wallet;
  let l2Deployer: Wallet;
  let l1Token: ERC20Stub;
  let l1TokenBridge: L1TokenBridge;
  let l2TokenBridge: L2TokenBridge;
  let l2Token: ERC20Ownable;
  let addressAliasHelper: AddressAliasHelper;
  let crossDomainMessengerStub: CrossDomainMessengerStub;
  let optimismProvider: JsonRpcProvider;

  before(async () => {
    optimismProvider = new ethers.providers.JsonRpcProvider(
      "http://localhost:9545"
    );
    const CrossDomainMessengerStubFactory = await ethers.getContractFactory(
      "CrossDomainMessengerStub"
    );
    crossDomainMessengerStub =
      (await CrossDomainMessengerStubFactory.deploy()) as CrossDomainMessengerStub;

    for (let key in OPT_L2_DEPENDENCIES) {
      OPT_L2_DEPENDENCIES[key].messenger = crossDomainMessengerStub.address;
    }
    console.log("CDM", crossDomainMessengerStub.address);
  });

  before(async () => {
    l1Deployer = getDeployer("local", hre);
    l2Deployer = getDeployer("local_optimism", hre);

    // deploy L1Token stub
    l1Token = await new ERC20Stub__factory(l1Deployer).deploy("L1 Token", "L1");

    const [l1DeployScript, l2DeployScript] =
      await createOptimismBridgeDeployScripts(
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
    const l1Contracts = await l1DeployScript.run();
    const l2Contracts = await l2DeployScript.run();

    l1TokenBridge = L1TokenBridge__factory.connect(
      l1Contracts[1].address,
      l1Deployer
    );
    l2Token = ERC20Ownable__factory.connect(l2Contracts[1].address, l2Deployer);
    l2TokenBridge = L2TokenBridge__factory.connect(
      l2Contracts[3].address,
      l2Deployer
    );
    const AddressAliasHelperFactory = await ethers.getContractFactory(
      "AddressAliasHelper"
    );
    addressAliasHelper =
      (await AddressAliasHelperFactory.deploy()) as AddressAliasHelper;

    await crossDomainMessengerStub.setXDomainMessageSender(
      l1TokenBridge.address
    );

    // initialize token bridge

    const roles = await Promise.all([
      l1TokenBridge.DEPOSITS_ENABLER_ROLE(),
      l1TokenBridge.DEPOSITS_DISABLER_ROLE(),
      l1TokenBridge.WITHDRAWALS_ENABLER_ROLE(),
      l1TokenBridge.WITHDRAWALS_DISABLER_ROLE(),
    ]);

    for (const role of roles) {
      await l1TokenBridge.grantRole(role, l1Deployer.address);
      await l2TokenBridge.grantRole(role, l2Deployer.address);
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
    const amount = wei`1 ether`;

    await l1Token.approve(l1TokenBridge.address, amount);
    const depositTx = await l1TokenBridge.depositERC20(
      l1Token.address,
      l2Token.address,
      amount,
      200000,
      "0x"
    );
    const receipt = await depositTx.wait();

    assert.isNotEmpty(
      receipt.events?.filter((e) => e.event === "ERC20DepositInitiated")
    );

    const addressToImpersonate = await addressAliasHelper.applyL1ToL2Alias(
      "0x25ace71c97b33cc4729cf772ae268934f7ab5fa1"
    );
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addressToImpersonate],
    });
    const optimismOracle = optimismProvider.getSigner(addressToImpersonate);
    await l2Deployer.sendTransaction({
      to: addressToImpersonate,
      value: ethers.utils.parseEther("1.0"),
    });
    const optimismMessageRelayer: any = await ethers.getContractAt(
      CrossDomainMessengerABI,
      crossDomainMessengerStub.address,
      optimismOracle
    );
    const iface = new ethers.utils.Interface(L2TokenBridgeABI);
    const relayData = iface.encodeFunctionData("finalizeDeposit", [
      l1Token.address,
      l2Token.address,
      l1Deployer.address,
      l2Deployer.address,
      amount,
      "0x",
    ]);

    const relayTx = await optimismMessageRelayer.relayMessage(
      l2TokenBridge.address,
      l1TokenBridge.address,
      relayData,
      depositTx.nonce
    );

    const receipt1 = await relayTx.wait();

    console.log(receipt1);
    console.log(await l2Token.balanceOf(l2Deployer.address));
  });
});
