import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'

export class SettlementService {
  recordSessionEarnings(sessionId: string) {
    const db = getDb()

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as any
    if (!session) return

    const agent = db
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(session.agent_id) as any
    if (!agent) return

    const startedAt = session.started_at
      ? new Date(session.started_at).getTime()
      : Date.now()
    const endedAt = session.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now()
    const durationSec = Math.max(0, (endedAt - startedAt) / 1000)

    const earnedAmount = Math.floor(durationSec * session.curator_rate)
    if (earnedAmount <= 0) return

    // Use INSERT OR IGNORE to prevent duplicate settlement race condition
    const result = db.prepare(
      `
      INSERT OR IGNORE INTO curator_earnings (id, curator_wallet, agent_id, session_id, earned_amount, paid_out)
      VALUES (?, ?, ?, ?, ?, 0)
    `,
    ).run(
      randomUUID(),
      agent.creator_wallet,
      agent.id,
      sessionId,
      earnedAmount,
    )
    if (result.changes === 0) return // already settled

    console.log(
      `[Settlement] Recorded ${earnedAmount} USDC units for curator ${agent.creator_wallet}`,
    )
  }

  getCuratorEarnings(curatorWallet: string) {
    const db = getDb()

    const earnings = db
      .prepare(
        `
      SELECT 
        ce.*,
        a.name as agent_name,
        s.started_at,
        s.ended_at,
        s.status as session_status
      FROM curator_earnings ce
      JOIN agents a ON ce.agent_id = a.id
      JOIN sessions s ON ce.session_id = s.id
      WHERE ce.curator_wallet = ? COLLATE NOCASE
      ORDER BY ce.created_at DESC
    `,
      )
      .all(curatorWallet) as any[]

    const totalEarned = earnings.reduce(
      (sum, e) => sum + e.earned_amount,
      0,
    )
    const totalPaidOut = earnings
      .filter((e) => e.paid_out)
      .reduce((sum, e) => sum + e.earned_amount, 0)

    return {
      curatorWallet,
      totalEarned,
      totalPaidOut,
      pendingPayout: totalEarned - totalPaidOut,
      sessions: earnings,
    }
  }

  getAllEarnings() {
    const db = getDb()
    return db
      .prepare(
        `
      SELECT 
        ce.curator_wallet,
        SUM(ce.earned_amount) as total_earned,
        COUNT(DISTINCT ce.session_id) as session_count,
        SUM(CASE WHEN ce.paid_out = 1 THEN ce.earned_amount ELSE 0 END) as paid_out
      FROM curator_earnings ce
      GROUP BY ce.curator_wallet
    `,
      )
      .all()
  }
}

export const settlementService = new SettlementService()
