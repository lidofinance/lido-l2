import { BigNumberish, ethers } from "ethers";

export function domainSeparator(
  name: string,
  version: string,
  chainId: BigNumberish,
  verifyingContract: string
): string {
  const eip712Domain: ethers.TypedDataDomain = {
    name,
    version,
    chainId,
    verifyingContract,
  };

  return ethers.utils._TypedDataEncoder.hashDomain(eip712Domain);
}
