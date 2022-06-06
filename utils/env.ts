import { HardhatRuntimeEnvironment } from "hardhat/types";

export function getEnvVariable(variableName: string, defaultValue?: string) {
  const value = process.env[variableName];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(
      `Error: ENV variable ${variableName} is not set and default value wasn't provided`
    );
  }
  return (value || defaultValue) as string;
}

export function getAddress(
  addressName: string,
  hre: HardhatRuntimeEnvironment
) {
  return hre.ethers.utils.getAddress(getEnvVariable(addressName));
}

export function getEnum(variableName: string, allowedValues: string[]) {
  const value = getEnvVariable(variableName);
  if (!allowedValues.includes(value)) {
    throw new Error(
      `Variable ${variableName} not in allowed values: ${allowedValues}`
    );
  }
  return value;
}
