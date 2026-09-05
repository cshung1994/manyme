process.env.DATABASE_URL = 'file::memory:'

import { test, expect, describe, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db/client.js'
import {
  deposit,
  getBalance,
  reserveDeposit,
  accrueCharge,
} from '../services/session/billingService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaSql = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf-8')

describe('billingService', () => {
  beforeAll(() => {
    getDb().exec(schemaSql)
  })

  test('deposit increases balance', () => {
    const balance = deposit('0xdepositor', 10000)
    expect(balance).toBe(10000)

    const balance2 = deposit('0xdepositor', 5000)
    expect(balance2).toBe(15000)
  })

  test('getBalance returns 0 for unknown wallet', () => {
    const balance = getBalance('0xunknown_wallet_never_seen')
    expect(balance).toBe(0)
  })

  test('reserveDeposit throws on insufficient balance', () => {
    expect(() => reserveDeposit('0xpoor_wallet', 1000)).toThrow('Insufficient balance')
  })

  test('accrueCharge deducts correctly', () => {
    deposit('0xchargetest', 50000)

    const charged = accrueCharge('sess-1', '0xchargetest', 100, 10)
    expect(charged).toBe(1000)

    const remaining = getBalance('0xchargetest')
    expect(remaining).toBe(49000)
  })
})
