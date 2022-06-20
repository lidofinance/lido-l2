import { toAddress } from "@eth-optimism/sdk";

export function loadString(variableName: string, defaultValue?: string) {
  const value = process.env[variableName];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(
      `ENV variable ${variableName} is not set and default value wasn't provided`
    );
  }
  return (value || defaultValue) as string;
}

export function getAddress(variableName: string, defaultValue?: string) {
  return toAddress(loadString(variableName, defaultValue));
}

export function getEnum(
  variableName: string,
  allowedValues: string[],
  defaultValue?: string
) {
  const value = loadString(variableName, defaultValue);
  if (!allowedValues.includes(value)) {
    throw new Error(
      `Variable ${variableName} not in allowed values: ${allowedValues}`
    );
  }
  return value;
}

export function getBool(variableName: string, defaultValue?: boolean) {
  return loadString(variableName, defaultValue?.toString()) === "true";
}

export function getList(variableName: string, defaultValue?: string[]) {
  const value = JSON.parse(
    loadString(variableName, JSON.stringify(defaultValue))
  );
  if (!Array.isArray(value)) {
    throw new Error(`ENV variable ${variableName} is not valid array`);
  }
  return value;
}

export function getAddressList(variableName: string, defaultValue?: string[]) {
  return getList(variableName, defaultValue).map(toAddress);
}

export default {
  string: loadString,
  list: getList,
  enum: getEnum,
  bool: getBool,
  address: getAddress,
  addresses: getAddressList,
};
