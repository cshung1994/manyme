import type { Context, MiddlewareHandler, Next } from 'hono'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import { config } from '../../config.js'

export interface PriceConfig {
  amount: string
  asset: 'USDC'
  network: 'base' | 'base-sepolia'
}

export const QUERY_PRICES: Record<string, PriceConfig> = {
  '/queries/agent/:id/summary': { amount: '0.001', asset: 'USDC', network: 'base-sepolia' },
  '/queries/agent/:id/ask': { amount: '0.003', asset: 'USDC', network: 'base-sepolia' },
  '/queries/agent/:id/evidence': { amount: '0.005', asset: 'USDC', network: 'base-sepolia' },
}

const CAIP2_NETWORKS: Record<PriceConfig['network'], `eip155:${number}`> = {
  'base': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
}

// Shared resource server: verifies and settles payments via the facilitator
let resourceServer: x402ResourceServer | null = null
function getResourceServer(): x402ResourceServer {
  if (!resourceServer) {
    const facilitator = new HTTPFacilitatorClient({ url: config.x402FacilitatorUrl })
    resourceServer = new x402ResourceServer(facilitator)
      .register('eip155:84532', new ExactEvmScheme())
      .register('eip155:8453', new ExactEvmScheme())
  }
  return resourceServer
}

function logSale(c: Context, price: PriceConfig, payerAddress: string) {
  try {
    const db = getDb()
    // agents.id is a UUID string — keep it verbatim or the FK check fails
    const agentId = c.req.param('id') || ''
    const paymentHeader = c.req.header('X-Payment') || c.req.header('x-payment') || ''
    db.prepare(`
      INSERT INTO query_sales (id, agent_id, route, payer_address, amount_usdc, receipt_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      randomUUID(),
      agentId,
      c.req.path,
      payerAddress,
      price.amount,
      paymentHeader.slice(0, 100),
    )
  } catch (e) {
    console.error('[x402] Failed to record query sale:', e)
  }
}

/** Best-effort payer extraction from the base64 X-PAYMENT payload. */
function extractPayer(c: Context): string {
  try {
    const header = c.req.header('X-Payment') || c.req.header('x-payment')
    if (!header) return 'unknown'
    const payload = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    return payload?.payload?.authorization?.from || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Real x402 middleware: 402 challenge + facilitator verify/settle.
 * The '*' route pattern is used because this middleware is attached per-route,
 * so whatever path reaches it is the protected resource.
 */
function realX402Middleware(price: PriceConfig): MiddlewareHandler {
  const gate = paymentMiddleware(
    {
      '*': {
        accepts: {
          scheme: 'exact',
          price: `$${price.amount}`,
          network: CAIP2_NETWORKS[price.network],
          payTo: config.platformWallet as `0x${string}`,
        },
        description: `Pay ${price.amount} ${price.asset} to access this analysis`,
      },
    },
    getResourceServer(),
  )

  return async (c: Context, next: Next) => {
    return gate(c, async () => {
      logSale(c, price, extractPayer(c))
      await next()
    })
  }
}

/** Mock middleware (X402_MOCK=true): accepts any non-empty X-Payment header. */
function mockX402Middleware(price: PriceConfig): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const paymentHeader = c.req.header('X-Payment') || c.req.header('x-payment')

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        x402Version: 1,
        accepts: [{
          scheme: 'exact',
          network: price.network,
          maxAmountRequired: price.amount,
          resource: c.req.url,
          description: `Pay ${price.amount} ${price.asset} to access this analysis`,
          mimeType: 'application/json',
          payTo: process.env.X402_PAYMENT_ADDRESS || process.env.PLATFORM_WALLET || '0x0000000000000000000000000000000000000000',
          maxTimeoutSeconds: 300,
          asset: price.asset === 'USDC'
            ? (process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e')
            : price.asset,
          extra: { name: 'ManyMe Analysis', version: '1.0' },
        }],
      }, 402)
    }

    logSale(c, price, 'unknown')
    await next()
  }
}

export function x402Middleware(price: PriceConfig): MiddlewareHandler {
  if (config.x402Mock) return mockX402Middleware(price)

  if (!config.platformWallet || config.platformWallet === '0x0000000000000000000000000000000000000000') {
    console.warn('[x402] PLATFORM_WALLET not set — falling back to mock payments. Set PLATFORM_WALLET (and X402_MOCK=false) for real payments.')
    return mockX402Middleware(price)
  }
  return realX402Middleware(price)
}
