import { erc20Abi, parseEventLogs } from 'viem'
import { publicClient } from '../onchain/baseClient.js'
import { config } from '../../config.js'
import { getDb } from '../../db/client.js'

export class DepositVerificationError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
  }
}

/**
 * Verifies that txHash is a successful on-chain USDC transfer from `wallet`
 * to the escrow address, and returns the transferred amount (USDC base units).
 * The client-claimed amount is never trusted.
 */
export async function verifyDepositTx(txHash: `0x${string}`, wallet: string): Promise<number> {
  if (!config.escrowAddress) {
    throw new DepositVerificationError('Deposits unavailable: escrow address not configured', 503)
  }
  if (!config.usdcAddress) {
    throw new DepositVerificationError('Deposits unavailable: USDC address not configured', 503)
  }

  let receipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash })
  } catch {
    throw new DepositVerificationError('Transaction not found on chain. Wait for confirmation and retry.', 404)
  }
  if (receipt.status !== 'success') {
    throw new DepositVerificationError('Transaction reverted on chain', 400)
  }

  const usdc = config.usdcAddress.toLowerCase()
  const escrow = config.escrowAddress.toLowerCase()
  const from = wallet.toLowerCase()

  const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' })
  let total = 0n
  for (const log of transfers) {
    if (
      log.address.toLowerCase() === usdc &&
      log.args.from.toLowerCase() === from &&
      log.args.to.toLowerCase() === escrow
    ) {
      total += log.args.value
    }
  }

  if (total <= 0n) {
    throw new DepositVerificationError('Transaction contains no USDC transfer from your wallet to the escrow address', 400)
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DepositVerificationError('Deposit amount too large', 400)
  }
  return Number(total)
}

/** Records the tx hash (replay protection). Returns false if already credited. */
export function recordDeposit(txHash: string, wallet: string, amount: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    INSERT OR IGNORE INTO deposits (tx_hash, wallet, amount) VALUES (?, ?, ?)
  `).run(txHash.toLowerCase(), wallet.toLowerCase(), amount)
  return result.changes > 0
}
