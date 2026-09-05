import { base, baseSepolia } from 'viem/chains'

// ─── Chain definitions ────────────────────────────────────────

export { base, baseSepolia }

// ─── Contract addresses per chain ────────────────────────────

export interface NetworkConfig {
  usdcAddress: `0x${string}`
  escrowAddress: `0x${string}`
  explorerUrl: string
  label: string
}

export const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Base Sepolia (testnet)
  [baseSepolia.id]: {
    usdcAddress:   '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle USDC on Base Sepolia
    escrowAddress: '0x0000000000000000000000000000000000000000', // redeploy escrow on Base Sepolia
    explorerUrl:   'https://sepolia.basescan.org',
    label: 'Base Sepolia',
  },
  // Base Mainnet (addresses TBD — update after deployment)
  [base.id]: {
    usdcAddress:   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Circle USDC on Base
    escrowAddress: '0x0000000000000000000000000000000000000000', // placeholder
    explorerUrl:   'https://basescan.org',
    label: 'Base',
  },
}

/** Returns the config for the currently connected chain, falling back to testnet. */
export function getNetworkConfig(chainId: number | undefined): NetworkConfig {
  return NETWORK_CONFIGS[chainId ?? baseSepolia.id] ?? NETWORK_CONFIGS[baseSepolia.id]
}
