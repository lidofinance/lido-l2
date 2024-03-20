import { ethers } from "hardhat";
import L1TokenBridgeABI from '../abi/L1TokenBridge'
import { L1ERC20TokenBridge } from "../typechain";

async function test() {
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia')
    const l1ERC20TokenBridge = new ethers.Contract('0xcb4619437c5bb35d26346dea9feb9bd73c4f2633', L1TokenBridgeABI, provider) as L1ERC20TokenBridge
    const wallet = new ethers.Wallet('', provider)
    console.log('send')
    const tx = await l1ERC20TokenBridge
      .connect(wallet)
      .depositERC20To(
        '0xB82381A3fBD3FaFA77B3a7bE693342618240067b',
        '0x9b72b0D75e2eb87579694E842741738d3a9C311E',
        '0xAf5B6AE540fCf3BD76f1b4C83fC87143932AAd09',
        ethers.utils.parseEther('0.0001'),
        2_000_000,
        "0x"
      );
    console.log('done', await tx.wait())
}

test()