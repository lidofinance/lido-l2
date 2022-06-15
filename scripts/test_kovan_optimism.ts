import { ethers, network, config } from "hardhat"
import { CrossChainMessenger, MessageStatus, StandardBridgeAdapter, Chain } from "@eth-optimism/sdk"
import metaInit from "./lib/meta"
import { utils, Wallet } from "ethers"
import { fetchJson } from "ethers/lib/utils"

const [netName, netLayer] = network.name.split("_")
const meta = metaInit(network.name)

const PRIVATE_KEY = process.env.PRIVATE_KEY || ""

// The ABI fragment for an ERC20 we need to get a user's balance.
const erc20ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  }
] // erc20ABI

async function main() {
  let { l1BridgeAddress, l2BridgeAddress, l1wstETHAddress, l2wstETHAddress } = meta.read()
  const netNameL1 = netName 
  const netNameL2 = netName + "_optimism"

  const { url: l1RpcUrl } = config.networks[netNameL1] as { url: string }
  const { url: l2RpcUrl } = config.networks[netNameL2] as { url: string }

  const l1Provider = new ethers.providers.JsonRpcProvider(l1RpcUrl)
  const l2Provider = new ethers.providers.JsonRpcProvider(l2RpcUrl)
  const wallet = new Wallet(PRIVATE_KEY)

  const l1Signer = wallet.connect(l1Provider)
  const l2Signer = wallet.connect(l2Provider)

  const crossChainMessenger = new CrossChainMessenger({
    l1ChainId: Chain.KOVAN,
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
    bridges: {
      LidoBridge: {
        Adapter: StandardBridgeAdapter,
        l1Bridge: l1BridgeAddress,
        l2Bridge: l2BridgeAddress,
      },
    },
  })
  const l1ERC20 = new ethers.Contract(l1wstETHAddress, erc20ABI, l1Signer)
  const l2ERC20 = new ethers.Contract(l2wstETHAddress, erc20ABI, l2Signer)

  const reportBalances = async () => {
    const l1Balance = utils.formatEther(await crossChainMessenger.l1Signer.getBalance())
    const l2Balance = utils.formatEther(await crossChainMessenger.l2Signer.getBalance())

    console.log(`L1:${l1Balance} ETH    L2:${l2Balance} ETH`)
  } // reportBalances

  const reportERC20Balances = async () => {
    const l1Balance = utils.formatEther(await l1ERC20.balanceOf(l1Signer.address))
    const l2Balance = utils.formatEther(await l2ERC20.balanceOf(l2Signer.address))
    console.log(`L1:${l1Balance} wstETH    L2:${l2Balance} wstETH`)
  } // reportERC20Balances

  const amount = utils.parseEther("0.01")

  const depositERC20 = async () => {
    console.log("Deposit ERC20")
    await reportERC20Balances()
    const start = +new Date()

    // Need the l2 address to know which bridge is responsible
    const allowanceResponse = await crossChainMessenger.approveERC20(l1ERC20.address, l2ERC20.address, amount)
    await allowanceResponse.wait()
    console.log(`Allowance given by tx ${allowanceResponse.hash}`)
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)

    const response = await crossChainMessenger.depositERC20(l1ERC20.address, l2ERC20.address, amount)
    console.log(`Deposit transaction hash (on L1): ${response.hash}`)
    await response.wait()
    console.log("Waiting for status to change to RELAYED")
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash, MessageStatus.RELAYED)

    await reportERC20Balances()
    console.log(`depositERC20 took ${(+new Date() - start) / 1000} seconds\n\n`)
  } // depositETH()

  const withdrawERC20 = async () => {
    console.log("Withdraw ERC20")
    const start = +new Date()
    await reportERC20Balances()

    const response = await crossChainMessenger.withdrawERC20(l1ERC20.address, l2ERC20.address, amount)
    console.log(`Transaction hash (on L2): ${response.hash}`)
    await response.wait()

    console.log("Waiting for status to change to IN_CHALLENGE_PERIOD")
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash, MessageStatus.IN_CHALLENGE_PERIOD)
    console.log("In the challenge period, waiting for status READY_FOR_RELAY")
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash, MessageStatus.READY_FOR_RELAY)
    console.log("Ready for relay, finalizing message now")
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)
    await crossChainMessenger.finalizeMessage(response)
    console.log("Waiting for status to change to RELAYED")
    console.log(`Time so far ${(+new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response, MessageStatus.RELAYED)
    await reportERC20Balances()
    console.log(`withdrawERC20 took ${(+new Date() - start) / 1000} seconds\n\n\n`)
  } // withdrawERC20()

  await reportBalances()
  await reportERC20Balances()

  await depositERC20()
  await withdrawERC20()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})