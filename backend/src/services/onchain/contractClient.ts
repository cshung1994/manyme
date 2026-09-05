import { publicClient } from './baseClient.js'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow.js'
import { config } from '../../config.js'

export function getEscrowAddress() {
  return config.escrowAddress as `0x${string}`
}

export async function getSession(sessionId: bigint) {
  if (!config.escrowAddress) return null
  return publicClient.readContract({
    address: getEscrowAddress(),
    abi: manyMeEscrowAbi,
    functionName: 'getSession',
    args: [sessionId],
  })
}

export async function getAgent(agentId: bigint) {
  if (!config.escrowAddress) return null
  return publicClient.readContract({
    address: getEscrowAddress(),
    abi: manyMeEscrowAbi,
    functionName: 'getAgent',
    args: [agentId],
  })
}
