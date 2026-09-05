import { createHmac } from 'crypto'
import { config } from '../../config.js'

const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 30_000

function getCached(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

function sign(timestamp: string, method: string, path: string, body: string): string {
  const prehash = timestamp + method.toUpperCase() + path + body
  return createHmac('sha256', config.okxSecretKey || 'mock-secret')
    .update(prehash)
    .digest('base64')
}

export async function onchainOSRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T | null> {
  const cacheKey = `${method}:${path}:${JSON.stringify(body || {})}`
  const cached = getCached(cacheKey)
  if (cached) return cached as T

  if (!config.okxApiKey) {
    console.log(`[OnchainOS] No API key, returning null for ${path}`)
    return null
  }

  const timestamp = new Date().toISOString()
  const bodyStr = body ? JSON.stringify(body) : ''
  const signature = sign(timestamp, method, path, bodyStr)

  try {
    const res = await fetch(`https://web3.okx.com${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': config.okxApiKey,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': config.okxPassphrase || '',
        'OK-ACCESS-SIGN': signature,
      },
      body: body ? bodyStr : undefined,
    })

    if (!res.ok) {
      console.log(`[OnchainOS] API error ${res.status} for ${path}`)
      return null
    }

    const data = await res.json()
    setCache(cacheKey, data)
    return data as T
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log(`[OnchainOS] Request failed: ${message}`)
    return null
  }
}
