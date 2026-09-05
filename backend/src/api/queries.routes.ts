import { Hono } from 'hono'
import { x402Middleware } from '../services/payments/x402Server.js'
import { getDb } from '../db/client.js'

export const queriesRoutes = new Hono()

queriesRoutes.get('/agent/:id/summary',
  x402Middleware({ amount: '0.001', asset: 'USDC', network: 'base-sepolia' }),
  async (c) => {
    const agentId = c.req.param('id')
    const db = getDb()

    const steps = db.prepare(`
      SELECT ss.* FROM session_steps ss
      JOIN sessions s ON ss.session_id = s.id
      WHERE s.agent_id = ? AND ss.step_type = 'finding'
      ORDER BY ss.created_at DESC LIMIT 3
    `).all(agentId) as any[]

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any

    return c.json({
      agentId,
      agentName: agent?.name || 'Unknown Agent',
      summary: steps.length > 0
        ? steps.map(s => s.body).join(' ')
        : 'No analysis available yet. Start a session to generate insights.',
      timestamp: new Date().toISOString(),
      pricePaid: '0.001 USDC',
    })
  }
)

queriesRoutes.post('/agent/:id/ask',
  x402Middleware({ amount: '0.003', asset: 'USDC', network: 'base-sepolia' }),
  async (c) => {
    const agentId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const question = body.question || 'What is the current market state?'

    const db = getDb()
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any

    const recentSteps = db.prepare(`
      SELECT ss.body FROM session_steps ss
      JOIN sessions s ON ss.session_id = s.id
      WHERE s.agent_id = ? ORDER BY ss.created_at DESC LIMIT 5
    `).all(agentId) as any[]

    const context = recentSteps.map(s => s.body).join('. ')

    return c.json({
      agentId,
      question,
      answer: context
        ? `Based on recent analysis: ${context.slice(0, 200)}. ${question.includes('recommend') ? 'Recommendation: Monitor closely and adjust position if metrics change significantly.' : 'Current data suggests stable conditions.'}`
        : 'No recent analysis context available. Please start a session first.',
      timestamp: new Date().toISOString(),
      pricePaid: '0.003 USDC',
    })
  }
)

queriesRoutes.get('/agent/:id/evidence',
  x402Middleware({ amount: '0.005', asset: 'USDC', network: 'base-sepolia' }),
  async (c) => {
    const agentId = c.req.param('id')
    const db = getDb()

    const proofs = db.prepare(`
      SELECT p.* FROM proofs p
      JOIN sessions s ON p.session_id = s.id
      WHERE s.agent_id = ?
      ORDER BY p.submitted_at DESC LIMIT 10
    `).all(agentId) as any[]

    return c.json({
      agentId,
      proofCount: proofs.length,
      proofs: proofs.map(p => ({
        seq: p.seq,
        proofHash: p.proof_hash,
        txHash: p.tx_hash,
        submittedAt: p.submitted_at,
      })),
      timestamp: new Date().toISOString(),
      pricePaid: '0.005 USDC',
    })
  }
)
