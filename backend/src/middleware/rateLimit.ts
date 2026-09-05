import type { Context, Next } from 'hono'

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 120_000) {
      buckets.delete(key)
    }
  }
}, 60_000)

export function rateLimiter(opts: { maxRequests: number; windowMs: number }) {
  const { maxRequests, windowMs } = opts

  return async (c: Context, next: Next) => {
    const wallet: string | undefined = c.get('verifiedWallet') || c.req.header('x-wallet-address')
    // Fall back to IP for demo/unauthenticated requests
    const key = (wallet || c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'anonymous').toLowerCase()
    const now = Date.now()

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now }
      buckets.set(key, bucket)
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill
    const refill = Math.floor((elapsed / windowMs) * maxRequests)
    if (refill > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refill)
      bucket.lastRefill = now
    }

    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil(windowMs / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json({
        error: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000}s. Try again later.`,
      }, 429)
    }

    bucket.tokens--
    await next()
  }
}
