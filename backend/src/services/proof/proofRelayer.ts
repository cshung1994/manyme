import { getDb } from '../../db/client.js'
import { config } from '../../config.js'
import { buildProofPackage, hashProofPackage, saveProofPackage } from './proofBuilder.js'
import { sseHub } from '../realtime/sseHub.js'
import { randomUUID } from 'crypto'

const proofSeqs = new Map<string, number>()
const lastProofTimes = new Map<string, number>()

const PROOF_INTERVAL_MS = 4000

export class ProofRelayer {
  private intervalId?: ReturnType<typeof setInterval>
  private walletClient: any = null

  async start() {
    console.log('[ProofRelayer] Starting...')

    if (config.platformOperatorKey) {
      try {
        const { getWalletClient } = await import('../onchain/baseClient.js')
        this.walletClient = getWalletClient(config.platformOperatorKey as `0x${string}`)
        console.log('[ProofRelayer] Wallet client initialized')
      } catch (e) {
        console.log('[ProofRelayer] No wallet client (no operator key), running in mock mode')
      }
    }

    this.intervalId = setInterval(() => this.tick(), PROOF_INTERVAL_MS)
  }

  private async tick() {
    const db = getDb()
    const activeSessions = db
      .prepare("SELECT * FROM sessions WHERE status = 'active'")
      .all() as any[]

    for (const session of activeSessions) {
      await this.processSession(session)
    }
  }

  private async processSession(session: any) {
    const db = getDb()
    const now = Date.now()
    const lastProof = lastProofTimes.get(session.id) || 0

    if (now - lastProof < PROOF_INTERVAL_MS) return

    // Re-check session status to avoid submitting proofs for paused/stopped sessions
    const current = db.prepare('SELECT status FROM sessions WHERE id = ?').get(session.id) as { status: string } | undefined
    if (!current || current.status !== 'active') return

    const seq = (proofSeqs.get(session.id) || 0) + 1

    const lastProofRecord = db
      .prepare('SELECT * FROM proofs WHERE session_id = ? ORDER BY seq DESC LIMIT 1')
      .get(session.id) as any
    const sinceTime = lastProofRecord?.submitted_at || session.started_at || '2000-01-01'

    const steps = db
      .prepare(
        'SELECT * FROM session_steps WHERE session_id = ? AND created_at > ? ORDER BY seq ASC',
      )
      .all(session.id, sinceTime) as any[]

    // Heartbeat proofs submitted even with 0 steps — liveness signal, not just output
    const pkg = buildProofPackage(session.id, seq, steps)
    const proofHash = hashProofPackage(pkg)
    const metadataUri = saveProofPackage(pkg)

    let txHash: string | null = null
    if (this.walletClient && config.escrowAddress) {
      try {
        const { manyMeEscrowAbi } = await import('../../../../shared/abis/ManyMeEscrow.js')
        txHash = await this.walletClient.writeContract({
          address: config.escrowAddress as `0x${string}`,
          abi: manyMeEscrowAbi,
          functionName: 'submitProof',
          args: [BigInt(session.onchain_session_id || 0), proofHash, metadataUri],
        })
        console.log(`[ProofRelayer] Proof submitted on-chain: ${txHash}`)
      } catch (e: any) {
        console.log(
          `[ProofRelayer] On-chain submit failed (mock mode): ${e.message?.slice(0, 50)}`,
        )
      }
    } else {
      console.log(`[ProofRelayer] Mock proof for session ${session.id} seq=${seq}`)
    }

    db.prepare(
      `
      INSERT INTO proofs (id, session_id, seq, proof_hash, metadata_uri, tx_hash, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    ).run(randomUUID(), session.id, seq, proofHash, metadataUri, txHash)

    proofSeqs.set(session.id, seq)
    lastProofTimes.set(session.id, now)

    sseHub.emitProof(session.id, {
      seq,
      proofHash,
      txHash: txHash || undefined,
      ts: new Date().toISOString(),
    })

    sseHub.emitStep(session.id, {
      kind: 'commentary',
      title: 'Agent working...',
      body: `Analyzing session ${session.id} — proof #${seq} submitted`,
      ts: new Date().toISOString(),
    })

    sseHub.emitEarnings(session.id, seq * 4)
  }

  startProofLoop(_sessionId: string) {
    this.start()
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId)
  }
}
