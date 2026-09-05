import { onchainOSRequest } from './onchainosClient.js'

export interface TokenPrice {
  instId: string
  last: string
  vol24h: string
  change24h: string
}

export interface PoolData {
  poolAddress: string
  token0: string
  token1: string
  tvl: string
  volume24h: string
  fee: string
}

const MOCK_PRICES: TokenPrice[] = [
  { instId: 'ETH-USDC', last: '3124.22', vol24h: '1234567', change24h: '0.023' },
  { instId: 'OKB-USDC', last: '45.67', vol24h: '234567', change24h: '-0.012' },
  { instId: 'BTC-USDC', last: '67890.00', vol24h: '9876543', change24h: '0.015' },
]

const MOCK_POOL: PoolData = {
  poolAddress: '0x1234...5678',
  token0: 'ETH',
  token1: 'USDC',
  tvl: '2400000',
  volume24h: '180000',
  fee: '0.003',
}

export async function getTokenPrices(instIds: string[]): Promise<TokenPrice[]> {
  const result = await onchainOSRequest<{ data: TokenPrice[] }>(
    'GET',
    `/api/v5/market/tickers?instType=SPOT&instId=${instIds.join(',')}`
  )
  return result?.data || MOCK_PRICES.filter(p => instIds.length === 0 || instIds.includes(p.instId))
}

export async function getPoolData(chainId: number, poolAddress: string): Promise<PoolData> {
  const prices = await getTokenPrices(['ETH-USDC'])
  const ethPrice = parseFloat(prices[0]?.last || '3000')

  return {
    poolAddress,
    token0: 'ETH',
    token1: 'USDC',
    tvl: (ethPrice * 800).toFixed(0),
    volume24h: (ethPrice * 60).toFixed(0),
    fee: '0.003',
  }
}

export async function getCandles(instId: string, bar: string = '1H', limit: number = 24) {
  const result = await onchainOSRequest<{ data: string[][] }>(
    'GET',
    `/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`
  )
  return result?.data || []
}
