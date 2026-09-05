import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from './networks'

export { baseSepolia } from './networks'

export function createWagmiConfig() {
  return getDefaultConfig({
    appName: 'ManyMe',
    projectId: 'manyme',
    chains: [baseSepolia],
    ssr: true,
  })
}
