export const PLATFORM_FEE = 300

export function formatRate(microUnits: number): string {
  return `$${(microUnits / 1_000_000).toFixed(4)}/sec`
}

export function formatUSDC(microUnits: number): string {
  return `$${(microUnits / 1_000_000).toFixed(4)}`
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
