import { task, types } from "hardhat/config";
import { HttpNetworkConfig } from "hardhat/types";

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
    const config = hre.config.networks[networkName] as HttpNetworkConfig;
    if (!config) {
      throw new Error(
        `Network with name ${networkName} not found. Check your hardhat.config.ts file contains network with given name`
      );
    }
    await hre.run("node", { port, fork: config.url });
  });
