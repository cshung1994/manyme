import { Hono } from 'hono'
import { getDb } from '../db/client.js'
import { settlementService } from '../services/settlement/settlementService.js'
import { payoutCurator, PayoutError } from '../services/settlement/payoutService.js'
import { requireSignature } from '../middleware/verifySignature.js'

export const curatorRoutes = new Hono()

// Self-serve payout: the curator signs the request and receives all pending
// earnings as one on-chain USDC transfer from the platform operator wallet.
curatorRoutes.post('/payout',
  requireSignature('payout'),
  async (c) => {
    const wallet: string = c.get('verifiedWallet')
    try {
      const result = await payoutCurator(wallet)
      return c.json(result)
    } catch (e) {
      if (e instanceof PayoutError) {
        return c.json({ error: e.message }, e.status as 400)
      }
      throw e
    }
  },
)

curatorRoutes.get('/all/earnings', (c) => {
  const earnings = settlementService.getAllEarnings()
  return c.json(earnings)
})

curatorRoutes.get('/:wallet/earnings', (c) => {
  const wallet = c.req.param('wallet')
  const earnings = settlementService.getCuratorEarnings(wallet)
  return c.json(earnings)
})

curatorRoutes.get('/:wallet/agents', (c) => {
  const db = getDb()
  const wallet = c.req.param('wallet')
  const agents = db
    .prepare('SELECT * FROM agents WHERE curator_wallet = ? COLLATE NOCASE')
    .all(wallet)
  return c.json(agents)
})

curatorRoutes.get('/:wallet/sessions', (c) => {
  const db = getDb()
  const wallet = c.req.param('wallet')
  const sessions = db
    .prepare(
      `
    SELECT s.*, a.name as agent_name, ce.earned_amount as curator_earned
    FROM sessions s
    JOIN agents a ON s.agent_id = a.id
    LEFT JOIN curator_earnings ce ON ce.session_id = s.id
    WHERE a.curator_wallet = ? COLLATE NOCASE
    ORDER BY s.created_at DESC
    LIMIT 50
  `,
    )
    .all(wallet)
  return c.json(sessions)
})
