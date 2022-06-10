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
  CrossDomainMessengerStub__factory,
} from "../../typechain";
import {
  createOptimismBridgeDeployScripts,
  OPT_L2_DEPENDENCIES,
  OPT_L1_DEPENDENCIES,
} from "../../utils/deployment/optimism";
import { wei } from "../../utils/wei";
import { getDeployer } from "../../utils/deployment/network";
import L2TokenBridgeABI from "../../abi/L2TokenBridge";

describe("Optimism :: bridging integration test", () => {
  let l1Deployer: Wallet;
  let l2Deployer: Wallet;
  let l1Token: ERC20Stub;
  let l1TokenBridge: L1TokenBridge;
  let l2TokenBridge: L2TokenBridge;
  let l2Token: ERC20Ownable;
  let crossDomainMessengerStubL1: CrossDomainMessengerStub;
  let crossDomainMessengerStubL2: CrossDomainMessengerStub;
  let optimismProvider: JsonRpcProvider;
  let ethereumProvider: JsonRpcProvider;

  before(async () => {
    l1Deployer = getDeployer("local", hre);
    l2Deployer = getDeployer("local_optimism", hre);

    // optimismProvider = new ethers.providers.JsonRpcProvider(
    //   "http://localhost:9545"
    // );
    // ethereumProvider = new ethers.providers.JsonRpcProvider(
    //   "http://localhost:8545"
    // );
  });

  before(async () => {
    // crossDomainMessengerStubL1 = await new CrossDomainMessengerStub__factory(
    //   l1Deployer
    // ).deploy();

    // crossDomainMessengerStubL2 = await new CrossDomainMessengerStub__factory(
    //   l2Deployer
    // ).deploy();

    const CrossDomainMessengerStubFactory = await ethers.getContractFactory(
      "CrossDomainMessengerStub"
    );
    crossDomainMessengerStubL2 =
      (await CrossDomainMessengerStubFactory.deploy()) as CrossDomainMessengerStub;

    for (let key in OPT_L2_DEPENDENCIES) {
      OPT_L2_DEPENDENCIES[key].messenger = crossDomainMessengerStubL2.address;
    }
    // for (let key in OPT_L1_DEPENDENCIES) {
    //   OPT_L1_DEPENDENCIES[key].messenger = crossDomainMessengerStubL2.address;
    // }
  });

  before(async () => {
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

    await crossDomainMessengerStubL2.setXDomainMessageSender(
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
    // const operator = l2Deployer;
    // const amount = wei`1 ether`;
    // const initialBalanceL1 = await l1Token.balanceOf(operator.address);
    // const initialBalanceL2 = await l2Token.balanceOf(operator.address);
    // await l1Token.approve(l1TokenBridge.address, amount);
    // const depositTx = await l1TokenBridge.depositERC20(
    //   l1Token.address,
    //   l2Token.address,
    //   amount,
    //   200000,
    //   "0x"
    // );
    // const iface = new ethers.utils.Interface(L2TokenBridgeABI);
    // const relayData = iface.encodeFunctionData("finalizeDeposit", [
    //   l1Token.address,
    //   l2Token.address,
    //   l1Deployer.address,
    //   l2Deployer.address,
    //   amount,
    //   "0x",
    // ]);
    // const a = await crossDomainMessengerStubL2.relayMessage(
    //   l2TokenBridge.address,
    //   l1TokenBridge.address,
    //   relayData,
    //   depositTx.nonce
    // );
    // const receipt = await a.wait();
    // assert.strictEqual(
    //   initialBalanceL1,
    //   (await l1Token.balanceOf(operator.address)).add(amount)
    // );
    // assert.strictEqual(
    //   initialBalanceL2,
    //   (await l2Token.balanceOf(operator.address)).sub(amount)
    // );
  });

  it("depositERC20() -> finalizeDeposit()", async () => {
    const operator = l2Deployer;
    const amount = wei`1 ether`;
    const initialBalanceL2 = await l2Token.balanceOf(operator.address);

    const iface = new ethers.utils.Interface(L2TokenBridgeABI);
    const relayData = iface.encodeFunctionData("finalizeDeposit", [
      l1Token.address,
      l2Token.address,
      l1Deployer.address,
      l2Deployer.address,
      amount,
      "0x",
    ]);
    const a = await crossDomainMessengerStubL2.relayMessage(
      l2TokenBridge.address,
      l1TokenBridge.address,
      relayData,
      1
    );

    const receipt = await a.wait();

    assert.strictEqual(
      initialBalanceL2,
      (await l2Token.balanceOf(operator.address)).sub(amount)
    );
  });

  // it("withdraw() -> finalizeWithdraw()", async () => {
  //   const operator = l2Deployer;
  //   const amount = wei`1 ether`;
  //   const initialBalanceL1 = await l1Token.balanceOf(operator.address);
  //   const initialBalanceL2 = await l2Token.balanceOf(operator.address);

  //   await l2Token.approve(l2TokenBridge.address, amount);

  //   const depositTx = await l2TokenBridge.withdraw(
  //     l2Token.address,
  //     amount,
  //     200000,
  //     "0x"
  //   );
  // });
});
