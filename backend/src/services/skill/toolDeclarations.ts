import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'

const CHAIN_DESCRIPTION = 'Chain ID as string. Supported: "1" (Ethereum), "42161" (Arbitrum), "8453" (Base), "56" (BSC), "137" (Polygon)'

export const RPC_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'eth_blockNumber',
    description: 'Get the current block number on a chain. Use this to establish a reference block before making other calls.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
      },
      required: ['chain'],
    },
  },
  {
    name: 'eth_getBalance',
    description: 'Get the native token balance (ETH/MATIC/BNB) of an address in wei. Returns hex string.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        address: { type: SchemaType.STRING, description: '0x-prefixed address' },
        blockTag: { type: SchemaType.STRING, description: 'Block number as hex or "latest". Default: "latest"' },
      },
      required: ['chain', 'address'],
    },
  },
  {
    name: 'eth_getCode',
    description: 'Get the bytecode of a contract. Returns "0x" for EOA (non-contract) addresses. Use to check if an address is a contract.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        address: { type: SchemaType.STRING, description: '0x-prefixed contract address' },
        blockTag: { type: SchemaType.STRING, description: 'Block number as hex or "latest". Default: "latest"' },
      },
      required: ['chain', 'address'],
    },
  },
  {
    name: 'eth_call',
    description: 'Execute a read-only (view/pure) smart contract function call. The "data" field must be ABI-encoded calldata (4-byte selector + encoded params). Returns hex-encoded return value. Common selectors: name()=0x06fdde03, symbol()=0x95d89b41, decimals()=0x313ce567, totalSupply()=0x18160ddd, balanceOf(addr)=0x70a08231, getReserves()=0x0902f1ac, slot0()=0x3850c7bd, owner()=0x8da5cb5b, implementation()=0x5c60da1b',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        to: { type: SchemaType.STRING, description: '0x-prefixed contract address to call' },
        data: { type: SchemaType.STRING, description: 'ABI-encoded calldata (hex string starting with 0x)' },
        blockTag: { type: SchemaType.STRING, description: 'Block number as hex or "latest". Default: "latest"' },
      },
      required: ['chain', 'to', 'data'],
    },
  },
  {
    name: 'eth_getLogs',
    description: 'Get event logs from a contract. IMPORTANT: Always use bounded block ranges (max 2000 blocks per call). Use eth_blockNumber first to get the current block, then query recent ranges. Returns array of log objects with address, topics, data, blockNumber, transactionHash. Common topic0: Transfer=0xddf252ad..., Approval=0x8c5be1e5..., Swap (V3)=0xc42079f9...',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        address: { type: SchemaType.STRING, description: '0x-prefixed contract address to filter logs' },
        topics: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Array of topic filters. topic[0] is event signature hash. Use null for wildcard.',
        },
        fromBlock: { type: SchemaType.STRING, description: 'Start block as hex string (required). Max range: 2000 blocks.' },
        toBlock: { type: SchemaType.STRING, description: 'End block as hex string (required).' },
      },
      required: ['chain', 'fromBlock', 'toBlock'],
    },
  },
  {
    name: 'eth_getStorageAt',
    description: 'Read a raw storage slot of a contract. Returns 32-byte hex value. Useful for reading proxy implementation slots (e.g. EIP-1967 implementation slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        address: { type: SchemaType.STRING, description: '0x-prefixed contract address' },
        slot: { type: SchemaType.STRING, description: 'Storage slot as hex string (e.g. "0x0")' },
        blockTag: { type: SchemaType.STRING, description: 'Block number as hex or "latest". Default: "latest"' },
      },
      required: ['chain', 'address', 'slot'],
    },
  },
  {
    name: 'eth_getTransactionReceipt',
    description: 'Get the receipt of a transaction by its hash. Returns status, gasUsed, logs, contractAddress (if deployment), and other fields.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        txHash: { type: SchemaType.STRING, description: '0x-prefixed transaction hash' },
      },
      required: ['chain', 'txHash'],
    },
  },
  {
    name: 'eth_getBlockByNumber',
    description: 'Get block info by number. Returns timestamp, gasUsed, transactions count, etc. Useful for establishing time context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        chain: { type: SchemaType.STRING, description: CHAIN_DESCRIPTION },
        blockNumber: { type: SchemaType.STRING, description: 'Block number as hex or "latest"' },
      },
      required: ['chain', 'blockNumber'],
    },
  },
]

/**
 * Filter declarations to only include the methods specified in tools_json config.
 * If no filter, return all.
 */
export function getToolDeclarations(toolsJson?: string | null): FunctionDeclaration[] {
  if (!toolsJson) return RPC_TOOL_DECLARATIONS

  try {
    const config = JSON.parse(toolsJson)
    const methods: string[] = config.methods || []
    if (methods.length === 0) return RPC_TOOL_DECLARATIONS
    return RPC_TOOL_DECLARATIONS.filter(d => methods.includes(d.name))
  } catch {
    return RPC_TOOL_DECLARATIONS
  }
}
