import { test, expect, describe, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaSql = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf-8')

describe('schema.sql', () => {
  let db: InstanceType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(schemaSql)
  })

  test('creates agents table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
      .all()
    expect(tables).toHaveLength(1)
  })

  test('creates agent_executions table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_executions'")
      .all()
    expect(tables).toHaveLength(1)
  })

  test('creates agent_ratings table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_ratings'")
      .all()
    expect(tables).toHaveLength(1)
  })

  test('agents has correct columns', () => {
    const cols = db.prepare("PRAGMA table_info('agents')").all() as { name: string }[]
    const colNames = cols.map((c) => c.name)

    expect(colNames).toContain('id')
    expect(colNames).toContain('creator_wallet')
    expect(colNames).toContain('system_prompt')
    expect(colNames).toContain('rate_per_second')
    expect(colNames).toContain('name')
    expect(colNames).toContain('description')
    expect(colNames).toContain('category')
    expect(colNames).toContain('model')
    expect(colNames).toContain('temperature')
    expect(colNames).toContain('max_tokens')
    expect(colNames).toContain('tools_json')
    expect(colNames).toContain('avg_rating')
    expect(colNames).toContain('run_count')
    expect(colNames).toContain('active')
    expect(colNames).toContain('created_at')
    expect(colNames).toContain('updated_at')
  })

  test('agents id column is TEXT PRIMARY KEY', () => {
    const cols = db.prepare("PRAGMA table_info('agents')").all() as {
      name: string
      type: string
      pk: number
    }[]
    const idCol = cols.find((c) => c.name === 'id')
    expect(idCol?.type).toBe('TEXT')
    expect(idCol?.pk).toBe(1)
  })
})
