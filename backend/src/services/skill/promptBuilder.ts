import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_ROOT = resolve(__dirname, '../../../../skills')

/**
 * Condensed system prompt for tool-use enabled skills.
 * Replaces the full SKILL.md to stay within reasonable token budget.
 */
export const TOOL_USE_SYSTEM_PROMPT = `You are a DeFi on-chain analyst with direct access to EVM blockchain data via RPC tools.

## Core Principle
First fix data confidence and context, then do minimum sufficient reads, then do attribution and narrative.
Confidence > Efficiency > Interpretation.

## Available Tools
You have 8 RPC tools: eth_blockNumber, eth_getBalance, eth_getCode, eth_call, eth_getLogs, eth_getStorageAt, eth_getTransactionReceipt, eth_getBlockByNumber.

## Workflow
1. SCOPE: Identify target (address/token/protocol), chain, and objective
2. DISCOVER: Check if address is contract (eth_getCode), read basic info (name, symbol, decimals via eth_call)
3. COLLECT: Get relevant on-chain data (balances, logs, storage). Always anchor to a specific block for consistency.
4. INTERPRET: Analyze data with classification-first approach. Apply adversarial review.
5. SYNTHESIZE: Present findings with confidence levels and data sources.

## Critical Rules
- ALWAYS call eth_blockNumber first to establish anchor block
- ALWAYS use bounded block ranges for eth_getLogs (max 2000 blocks per call)
- NEVER assume data — if you need it, read it on-chain
- Decode hex values properly: addresses are last 20 bytes, uint256 is full 32 bytes
- For ERC-20 calls: balanceOf(addr) = 0x70a08231 + addr padded to 32 bytes
- For proxy contracts: check EIP-1967 slot 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
- If an RPC call fails, report the error — never silently skip
- Disclose what you could NOT check (gaps in analysis)

## Common Function Selectors
name()=0x06fdde03, symbol()=0x95d89b41, decimals()=0x313ce567, totalSupply()=0x18160ddd,
balanceOf(addr)=0x70a08231, allowance(owner,spender)=0xdd62ed3e,
getReserves()=0x0902f1ac, slot0()=0x3850c7bd, liquidity()=0x1a686502,
owner()=0x8da5cb5b, implementation()=0x5c60da1b, admin()=0xf851a440

## Event Signatures (topic0)
Transfer(address,address,uint256)=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
Approval(address,address,uint256)=0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
Swap(V3)=0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67

## Tool Scope
- RPC tools work on EVM chains: Ethereum (1), Arbitrum (42161), Base (8453), BSC (56), Polygon (137)
- Google Search is available for ALL queries — use it to find current data (TVL, prices, protocol info) on any chain.
- For EVM queries: PREFER RPC tools for on-chain data, supplement with Google Search for context.
- For non-EVM chains (Sui, Solana, Aptos, Cosmos, etc.): USE Google Search to find current, accurate data.
  Do NOT use EVM RPC tools or reference EVM-specific concepts (Uniswap, ERC-20, etc.) for non-EVM queries.
- NEVER mix up chains: do not present EVM protocol data when the user asks about a different ecosystem.

## Output Format
For tool-verified (EVM) queries, always include:
- Chain and anchor block used
- Data confidence tier per finding (A=on-chain verified, B=archive, K=general knowledge)
- Specific contract addresses and function calls made
- Gaps: what was not investigated and why

For general knowledge queries (non-EVM), always include:
- Confidence tier: K (general knowledge — not live on-chain data)
- Sources or reasoning behind your answer
- Disclaimer that data may be outdated`

/**
 * Load pattern content based on keyword matching.
 * Returns relevant pattern excerpt to include in user prompt.
 */
const NON_EVM_KEYWORDS = ['sui', 'solana', 'aptos', 'cosmos', 'near', 'ton', 'cardano', 'move', 'wasm', 'ibc', 'cosmwasm']

export function loadRelevantPattern(query: string): string {
  const q = query.toLowerCase()

  // If query is about non-EVM chains, don't inject EVM-specific patterns
  if (NON_EVM_KEYWORDS.some(k => q.includes(k))) return ''

  const patternMap: Array<{ keywords: string[]; dirs: string[]; file: string }> = [
    { keywords: ['wallet', 'address', 'profil', 'fund flow', 'sybil', 'cluster'], dirs: ['defi-onchain-analytics-main'], file: 'wallet-analytics.md' },
    { keywords: ['pool', 'dex', 'swap', 'lp', 'liquidity', 'uniswap', 'amm'], dirs: ['defi-onchain-analytics-main'], file: 'dex-analytics.md' },
    { keywords: ['token', 'holder', 'supply', 'distribution', 'gini'], dirs: ['defi-onchain-analytics-main'], file: 'token-analytics.md' },
    { keywords: ['protocol', 'tvl', 'lending', 'oracle', 'governance'], dirs: ['defi-onchain-analytics-main'], file: 'protocol-analytics.md' },
    { keywords: ['vault', 'clamm', 'rebalance', 'concentrated'], dirs: ['defi-onchain-analytics-main'], file: 'clamm-vault-analytics.md' },
    { keywords: ['contract', 'proxy', 'storage', 'bytecode', 'abi'], dirs: ['defi-onchain-analytics-main'], file: 'contract-inspection.md' },
    { keywords: ['reentrancy', 'reentr'], dirs: ['smart-contract-security'], file: 'reentrancy-analysis.md' },
    { keywords: ['flash loan', 'oracle manipulation'], dirs: ['smart-contract-security'], file: 'flash-loan-attack.md' },
    { keywords: ['access control', 'admin', 'owner', 'upgrade'], dirs: ['smart-contract-security'], file: 'access-control-audit.md' },
    { keywords: ['audit', 'security', 'vulnerab'], dirs: ['smart-contract-security'], file: '' }, // master skill
    { keywords: ['momentum', 'rsi', 'macd', 'indicator'], dirs: ['trading-signal-engine'], file: 'momentum-analysis.md' },
    { keywords: ['risk', 'position size', 'stop loss'], dirs: ['trading-signal-engine'], file: 'risk-management.md' },
    { keywords: ['nft', 'collection', 'floor'], dirs: ['nft-market-intelligence'], file: 'collection-analysis.md' },
    { keywords: ['whale', 'tracking'], dirs: ['nft-market-intelligence'], file: 'whale-tracking.md' },
  ]

  for (const entry of patternMap) {
    if (entry.keywords.some(k => q.includes(k))) {
      for (const dir of entry.dirs) {
        const filePath = entry.file
          ? resolve(SKILLS_ROOT, dir, 'patterns', entry.file)
          : resolve(SKILLS_ROOT, dir, 'SKILL.md')

        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8')
          // Extract first ~3000 chars as relevant context
          const body = content.replace(/^---[\s\S]*?---\n?/, '').trim()
          return body.slice(0, 3000)
        }
      }
    }
  }

  return ''
}

/**
 * Build the full user prompt with reference context injected.
 */
export function buildToolUsePrompt(
  userQuery: string,
  inputs: Record<string, unknown>,
): string {
  const parts: string[] = []

  // User query
  parts.push(`## User Query\n${userQuery}`)

  // Additional inputs
  const extraInputs = Object.entries(inputs)
    .filter(([k]) => !['query', '_query'].includes(k))
    .map(([k, v]) => `- ${k}: ${v}`)
  if (extraInputs.length > 0) {
    parts.push(`\n## Parameters\n${extraInputs.join('\n')}`)
  }

  // Load relevant pattern context
  const pattern = loadRelevantPattern(userQuery + ' ' + JSON.stringify(inputs))
  if (pattern) {
    parts.push(`\n## Reference (from knowledge base)\n${pattern}`)
  }

  return parts.join('\n')
}
