// import hre from "hardhat";
import { task, types } from "hardhat/config";
import { getNetworkConfig } from "../utils/deployment/network";

task("node:fork")
  .addOptionalPositionalParam(
    "networkName",
    "Network name to create fork (default: mainnet)",
    "mainnet"
  )
  .addOptionalPositionalParam(
    "port",
    "The port on which to listen for new connections (default: 8545)",
    8545,
    types.int
  )
  .setAction(async ({ networkName, port }, hre) => {
    const config = getNetworkConfig(networkName, hre);
    await hre.run("node", { port, fork: config.url });
  });
