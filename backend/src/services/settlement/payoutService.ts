import { erc20Abi } from 'viem'
import { getDb } from '../../db/client.js'
import { config } from '../../config.js'
import { publicClient, getWalletClient } from '../onchain/baseClient.js'

export class PayoutError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
  }
}

function ensurePayoutColumn() {
  const db = getDb()
  try {
    db.exec('ALTER TABLE curator_earnings ADD COLUMN payout_tx_hash TEXT')
  } catch {
    // column already exists
  }
}

/**
 * Pays out all pending (unpaid) curator earnings for `curatorWallet` as a
 * single on-chain USDC transfer from the platform operator wallet, then
 * marks those rows as paid with the tx hash.
 */
export async function payoutCurator(curatorWallet: string): Promise<{ amount: number; txHash: string }> {
  if (!config.platformOperatorKey) {
    throw new PayoutError('Payouts unavailable: platform operator key not configured', 503)
  }
  ensurePayoutColumn()

  const db = getDb()
  const wallet = curatorWallet.toLowerCase()
  const rows = db.prepare(
    'SELECT id, earned_amount FROM curator_earnings WHERE curator_wallet = ? COLLATE NOCASE AND paid_out = 0',
  ).all(wallet) as Array<{ id: string; earned_amount: number }>

  const total = rows.reduce((sum, r) => sum + r.earned_amount, 0)
  if (total <= 0) {
    throw new PayoutError('No pending earnings to pay out', 400)
  }

  const walletClient = getWalletClient(config.platformOperatorKey as `0x${string}`)
  const txHash = await walletClient.writeContract({
    address: config.usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [wallet as `0x${string}`, BigInt(total)],
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })

  const mark = db.prepare('UPDATE curator_earnings SET paid_out = 1, payout_tx_hash = ? WHERE id = ?')
  for (const row of rows) mark.run(txHash, row.id)

  console.log(`[Payout] Paid ${total} USDC units to curator ${wallet} (tx ${txHash})`)
  return { amount: total, txHash }
}
