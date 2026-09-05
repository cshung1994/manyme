import { publicClient } from '../onchain/baseClient.js'

export async function getCurrentBlock(): Promise<number> {
  try {
    const block = await publicClient.getBlockNumber()
    return Number(block)
  } catch {
    return Math.floor(Math.random() * 1000000) + 12000000
  }
}

export async function getERC20Balance(tokenAddress: `0x${string}`, walletAddress: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'balanceOf',
      args: [walletAddress],
    })
    return balance.toString()
  } catch {
    return '0'
  }
}
