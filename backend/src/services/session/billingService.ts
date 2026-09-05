import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import { config } from '../../config.js'

const PLATFORM_FEE_BPS = Number(config.platformFeeRate)

export function getBalance(wallet: string): number {
  const db = getDb()
  const row = db
    .prepare('SELECT balance FROM user_balances WHERE wallet = $wallet')
    .get({ $wallet: wallet.toLowerCase() }) as { balance: number } | undefined

  return row?.balance ?? 0
}

export interface BalanceSummary {
  wallet: string
  balance: number
  total_deposited: number
  total_spent: number
}

export function getBalanceSummary(wallet: string): BalanceSummary {
  const db = getDb()
  const w = wallet.toLowerCase()
  const row = db
    .prepare('SELECT balance, total_deposited, total_spent FROM user_balances WHERE wallet = $wallet')
    .get({ $wallet: w }) as { balance: number; total_deposited: number; total_spent: number } | undefined

  return {
    wallet: w,
    balance: row?.balance ?? 0,
    total_deposited: row?.total_deposited ?? 0,
    total_spent: row?.total_spent ?? 0,
  }
}

export function deposit(wallet: string, amount: number): number {
  const db = getDb()
  const w = wallet.toLowerCase()

  db.prepare(`
    INSERT INTO user_balances (wallet, balance, total_deposited)
    VALUES ($wallet, $amount, $amount)
    ON CONFLICT(wallet) DO UPDATE SET
      balance = balance + $amount,
      total_deposited = total_deposited + $amount,
      updated_at = datetime('now')
  `).run({ $wallet: w, $amount: amount })

  return getBalance(w)
}

export function reserveDeposit(wallet: string, minAmount: number): void {
  const balance = getBalance(wallet)
  if (balance < minAmount) {
    throw new Error('Insufficient balance')
  }
}

// Atomically deducts using WHERE balance >= amount to prevent overdraft race conditions
export function accrueCharge(
  sessionId: string,
  wallet: string,
  ratePerSecond: number,
  durationSec: number,
): number {
  const totalCharged = Math.floor(ratePerSecond * durationSec)
  if (totalCharged <= 0) return 0

  const db = getDb()
  const w = wallet.toLowerCase()

  const result = db.prepare(`
    UPDATE user_balances SET
      balance = balance - $amount,
      total_spent = total_spent + $amount,
      updated_at = datetime('now')
    WHERE wallet = $wallet AND balance >= $amount
  `).run({ $wallet: w, $amount: totalCharged })

  if (result.changes === 0) return 0

  return totalCharged
}

export function settleSession(
  sessionId: string,
  curatorWallet: string,
  totalCharged: number,
  ratePerSecond: number,
): void {
  if (totalCharged <= 0) return

  const curatorAmount = Math.floor(
    totalCharged * (10000 - PLATFORM_FEE_BPS) / 10000,
  )
  const platformAmount = totalCharged - curatorAmount

  const db = getDb()

  const session = db
    .prepare('SELECT agent_id FROM sessions WHERE id = ?')
    .get(sessionId) as { agent_id: number } | undefined
  const agentId = session?.agent_id ?? 0

  db.prepare(`
    INSERT OR IGNORE INTO curator_earnings
      (id, curator_wallet, agent_id, session_id, earned_amount, paid_out)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    randomUUID(),
    curatorWallet.toLowerCase(),
    agentId,
    sessionId,
    curatorAmount,
  )

  console.log(
    `[Billing] Session ${sessionId} settled: curator=${curatorAmount} platform=${platformAmount} (total=${totalCharged})`,
  )
}
