import type { Context, Next, MiddlewareHandler } from 'hono'

export type SignatureEnv = {
  Variables: {
    verifiedWallet: string
  }
}
import { verifyMessage } from 'viem'

const TIMESTAMP_MAX_AGE_SEC = 300 // 5 minutes

// Nonce replay protection: track used signatures (sig hash → expiry timestamp)
const usedNonces = new Map<string, number>()

// Cleanup expired nonces every 60s
setInterval(() => {
  const now = Math.floor(Date.now() / 1000)
  for (const [key, expiry] of usedNonces) {
    if (now > expiry) usedNonces.delete(key)
  }
}, 60_000)

export function buildSignMessage(wallet: string, action: string, resourceId: string | undefined, timestamp: number): string {
  let msg = `ManyMe Action\nWallet: ${wallet}\nAction: ${action}\nTimestamp: ${timestamp}`
  if (resourceId) msg += `\nResource: ${resourceId}`
  return msg
}

/**
 * Hono middleware that verifies EIP-191 personal_sign signatures.
 * Includes nonce replay protection — each signature can only be used once.
 * On success, sets c.verifiedWallet to the recovered address.
 */
export function requireSignature(action: string): MiddlewareHandler<SignatureEnv> {
  return async (c, next) => {
    const wallet = c.req.header('x-wallet-address')
    const signature = c.req.header('x-signature')
    const timestampStr = c.req.header('x-timestamp')

    if (!wallet || !signature || !timestampStr) {
      return c.json({ error: 'Missing authentication headers: x-wallet-address, x-signature, x-timestamp' }, 401)
    }

    const timestamp = parseInt(timestampStr)
    if (isNaN(timestamp) || timestamp < 0) {
      return c.json({ error: 'Invalid timestamp' }, 401)
    }

    // Check timestamp freshness
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > TIMESTAMP_MAX_AGE_SEC) {
      return c.json({ error: 'Signature expired. Please sign again.' }, 401)
    }

    // Replay protection: reject already-used signatures
    const sigKey = signature.slice(0, 66) // first 33 bytes as key (enough for uniqueness)
    if (usedNonces.has(sigKey)) {
      return c.json({ error: 'Signature already used (replay detected). Please sign again.' }, 401)
    }

    // Build the expected message — use route param 'id' as resource identifier
    const resourceId = c.req.param('id')
    const message = buildSignMessage(wallet, action, resourceId, timestamp)

    try {
      const valid = await verifyMessage({
        address: wallet as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })

      if (!valid) {
        return c.json({ error: 'Invalid signature' }, 401)
      }
    } catch {
      return c.json({ error: 'Signature verification failed' }, 401)
    }

    // Mark signature as used (expires when timestamp would expire)
    usedNonces.set(sigKey, timestamp + TIMESTAMP_MAX_AGE_SEC)

    // Set verified wallet for downstream handlers
    c.set('verifiedWallet', wallet.toLowerCase())
    await next()
  }
}
