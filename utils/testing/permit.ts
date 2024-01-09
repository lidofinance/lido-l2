// from https://github.com/Uniswap/v3-periphery/blob/main/test/shared/permit.ts

import { BigNumberish, constants, Signature, Wallet } from 'ethers'
import { splitSignature } from 'ethers/lib/utils'
import { ERC20BridgedPermit } from '../../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export async function getPermitSignature(
  wallet: SignerWithAddress,
  token: ERC20BridgedPermit,
  spender: string,
  value: BigNumberish = constants.MaxUint256,
  deadline = constants.MaxUint256,
  permitConfig?: { nonce?: BigNumberish; name?: string; chainId?: number; version?: string }
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? token.nonces(wallet.address),
    permitConfig?.name ?? token.name(),
    permitConfig?.version ?? '1',
    permitConfig?.chainId ?? wallet.getChainId(),
  ])

  return splitSignature(
    await wallet._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}