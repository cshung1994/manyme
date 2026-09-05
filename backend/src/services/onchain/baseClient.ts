import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from '../../config.js'

const activeChain: Chain =
  config.baseRpc.includes('sepolia') || config.baseRpc.includes('testnet')
    ? baseSepolia
    : base

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(config.baseRpc),
})

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(config.baseRpc),
  })
}
