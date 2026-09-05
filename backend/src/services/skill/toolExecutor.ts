import { createPublicClient, http, type PublicClient, type Chain } from 'viem'
import { mainnet, arbitrum, base, baseSepolia, bsc, polygon } from 'viem/chains'

const CHAIN_MAP: Record<string, Chain> = {
  '1': mainnet,
  '42161': arbitrum,
  '8453': base,
  '84532': baseSepolia,
  '56': bsc,
  '137': polygon,
}

// Fallback RPC endpoints per chain
const RPC_ENDPOINTS: Record<string, string[]> = {
  '1': ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', 'https://ethereum-rpc.publicnode.com'],
  '42161': ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://arbitrum-one-rpc.publicnode.com'],
  '8453': ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
  '56': ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc', 'https://bsc-rpc.publicnode.com'],
  '137': ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://polygon-bor-rpc.publicnode.com'],
  '84532': ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
}

// Cached clients per chain
const clientCache = new Map<string, PublicClient>()

// Per-chain concurrency semaphore
const MAX_CONCURRENT = parseInt(process.env.RPC_MAX_CONCURRENT_PER_CHAIN || '5')
const chainSemaphores = new Map<string, { current: number; queue: Array<() => void> }>()

function getOrCreateSemaphore(chain: string) {
  if (!chainSemaphores.has(chain)) {
    chainSemaphores.set(chain, { current: 0, queue: [] })
  }
  return chainSemaphores.get(chain)!
}

async function acquireChainSlot(chain: string): Promise<void> {
  const sem = getOrCreateSemaphore(chain)
  if (sem.current < MAX_CONCURRENT) { sem.current++; return }
  return new Promise(resolve => sem.queue.push(resolve))
}

function releaseChainSlot(chain: string): void {
  const sem = getOrCreateSemaphore(chain)
  sem.current--
  const next = sem.queue.shift()
  if (next) { sem.current++; next() }
}

function getClient(chainId: string): PublicClient {
  if (clientCache.has(chainId)) return clientCache.get(chainId)!

  const chain = CHAIN_MAP[chainId]
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`)

  const endpoints = RPC_ENDPOINTS[chainId] || []
  const transport = http(endpoints[0] || chain.rpcUrls.default.http[0], { timeout: 15_000 })

  const client = createPublicClient({ chain, transport })
  clientCache.set(chainId, client)
  return client
}

const MAX_LOG_RANGE = 2000
const MAX_LOGS_RETURNED = 30
const RPC_TIMEOUT_MS = 15_000

export interface ToolResult {
  result?: unknown
  error?: string
}

/**
 * Execute a single RPC tool call. Returns structured result or error.
 */
export async function executeRpcTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
  const chainId = String(args.chain || '1')

  try {
    await acquireChainSlot(chainId)

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RPC timeout (15s)')), RPC_TIMEOUT_MS)
    )

    const resultPromise = executeRpcCall(toolName, chainId, args)
    return await Promise.race([resultPromise, timeoutPromise])
  } catch (e) {
    return { error: (e as Error).message }
  } finally {
    releaseChainSlot(chainId)
  }
}

async function executeRpcCall(toolName: string, chainId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const client = getClient(chainId)

  switch (toolName) {
    case 'eth_blockNumber': {
      const block = await client.getBlockNumber()
      return { result: { blockNumber: block.toString(), hex: '0x' + block.toString(16) } }
    }

    case 'eth_getBalance': {
      const balance = await client.getBalance({
        address: args.address as `0x${string}`,
        ...(args.blockTag && args.blockTag !== 'latest' ? { blockNumber: BigInt(args.blockTag as string) } : {}),
      })
      const ethValue = Number(balance) / 1e18
      return { result: { wei: balance.toString(), eth: ethValue.toFixed(6), hex: '0x' + balance.toString(16) } }
    }

    case 'eth_getCode': {
      const code = await client.getCode({
        address: args.address as `0x${string}`,
      })
      const isContract = code && code !== '0x' && code.length > 2
      return { result: { code: code?.slice(0, 200) + (code && code.length > 200 ? '...' : ''), isContract, bytecodeLength: code?.length || 0 } }
    }

    case 'eth_call': {
      const data = await client.call({
        to: args.to as `0x${string}`,
        data: args.data as `0x${string}`,
        ...(args.blockTag && args.blockTag !== 'latest' ? { blockNumber: BigInt(args.blockTag as string) } : {}),
      })
      return { result: { data: data.data || '0x' } }
    }

    case 'eth_getLogs': {
      const fromBlock = BigInt(args.fromBlock as string)
      const toBlock = BigInt(args.toBlock as string)
      const range = Number(toBlock - fromBlock)

      if (range > MAX_LOG_RANGE) {
        return { error: `Block range too large (${range}). Max allowed: ${MAX_LOG_RANGE}. Use eth_blockNumber to get current block and query smaller ranges.` }
      }
      if (range < 0) {
        return { error: 'fromBlock must be <= toBlock' }
      }

      const topics = args.topics as string[] | undefined
      const logs = await client.getLogs({
        address: args.address as `0x${string}` | undefined,
        topics: topics as any,
        fromBlock,
        toBlock,
      })

      const truncated = logs.length > MAX_LOGS_RETURNED
      const returnedLogs = logs.slice(0, MAX_LOGS_RETURNED).map(log => ({
        address: log.address,
        topics: log.topics,
        data: log.data.length > 500 ? log.data.slice(0, 500) + '...' : log.data,
        blockNumber: log.blockNumber?.toString(),
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      }))

      return {
        result: {
          logs: returnedLogs,
          totalFound: logs.length,
          ...(truncated ? { note: `Showing first ${MAX_LOGS_RETURNED} of ${logs.length} logs. Narrow the block range for complete results.` } : {}),
        },
      }
    }

    case 'eth_getStorageAt': {
      const value = await client.getStorageAt({
        address: args.address as `0x${string}`,
        slot: args.slot as `0x${string}`,
      })
      return { result: { value: value || '0x0000000000000000000000000000000000000000000000000000000000000000' } }
    }

    case 'eth_getTransactionReceipt': {
      const receipt = await client.getTransactionReceipt({
        hash: args.txHash as `0x${string}`,
      })
      return {
        result: {
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice.toString(),
          contractAddress: receipt.contractAddress,
          from: receipt.from,
          to: receipt.to,
          logsCount: receipt.logs.length,
        },
      }
    }

    case 'eth_getBlockByNumber': {
      const blockTag = args.blockNumber as string
      const block = blockTag === 'latest'
        ? await client.getBlock()
        : await client.getBlock({ blockNumber: BigInt(blockTag) })
      return {
        result: {
          number: block.number?.toString(),
          timestamp: block.timestamp.toString(),
          date: new Date(Number(block.timestamp) * 1000).toISOString(),
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          transactionCount: block.transactions.length,
          baseFeePerGas: block.baseFeePerGas?.toString(),
        },
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
