import { getDb } from '../../db/client.js'

const PROOF_WINDOW_MS = 30000
const CHECK_INTERVAL_MS = 5000

export class TimeoutWatcher {
  private intervalId?: ReturnType<typeof setInterval>

  start() {
    this.intervalId = setInterval(() => this.tick(), CHECK_INTERVAL_MS)
    console.log('[TimeoutWatcher] Started')
  }

  private tick() {
    const db = getDb()
    const activeSessions = db
      .prepare("SELECT * FROM sessions WHERE status = 'active'")
      .all() as any[]

    for (const session of activeSessions) {
      const lastProof = db
        .prepare(
          'SELECT submitted_at FROM proofs WHERE session_id = ? ORDER BY seq DESC LIMIT 1',
        )
        .get(session.id) as any

      if (!lastProof) continue

      const lastProofTime = new Date(lastProof.submitted_at).getTime()
      const elapsed = Date.now() - lastProofTime

      if (elapsed > PROOF_WINDOW_MS) {
        db.prepare("UPDATE sessions SET status = 'paused' WHERE id = ?").run(session.id)
        console.log(`[TimeoutWatcher] Session ${session.id} paused (proof timeout)`)
      }
    }
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId)
  }
}
