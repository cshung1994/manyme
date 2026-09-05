process.env.DATABASE_URL = 'file::memory:'

import { test, expect, describe, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db/client.js'
import {
  createAgent,
  listAgents,
  updateAgent,
  deactivateAgent,
  rateAgent,
} from '../services/agent/agentRegistry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaSql = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf-8')

describe('agentRegistry', () => {
  beforeAll(() => {
    getDb().exec(schemaSql)
  })

  test('createAgent returns agent with UUID id', () => {
    const agent = createAgent({
      creatorWallet: '0xabc',
      name: 'Test Agent',
      description: 'A test agent',
      systemPrompt: 'You are a test agent.',
    })

    expect(agent.id).toBeDefined()
    expect(typeof agent.id).toBe('string')
    expect(agent.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(agent.name).toBe('Test Agent')
    expect(agent.creator_wallet).toBe('0xabc')
  })

  test('listAgents returns created agents', () => {
    const agents = listAgents()
    expect(agents.length).toBeGreaterThanOrEqual(1)
    const found = agents.find((a) => a.name === 'Test Agent')
    expect(found).toBeDefined()
  })

  test('updateAgent updates name', () => {
    const agent = createAgent({
      creatorWallet: '0xdef',
      name: 'Original Name',
      description: 'desc',
      systemPrompt: 'prompt',
    })

    const updated = updateAgent(agent.id, {
      name: 'Updated Name',
      creatorWallet: '0xdef',
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.description).toBe('desc')
  })

  test('deactivateAgent hides agent from list', () => {
    const agent = createAgent({
      creatorWallet: '0x111',
      name: 'To Deactivate',
      description: 'will be deactivated',
      systemPrompt: 'prompt',
    })

    deactivateAgent(agent.id, '0x111')

    const agents = listAgents()
    const found = agents.find((a) => a.id === agent.id)
    expect(found).toBeUndefined()
  })

  test('rateAgent calculates correct average', () => {
    const agent = createAgent({
      creatorWallet: '0x222',
      name: 'Rateable Agent',
      description: 'rate me',
      systemPrompt: 'prompt',
    })

    rateAgent(agent.id, '0xuser1', 5)
    rateAgent(agent.id, '0xuser2', 3)
    const result = rateAgent(agent.id, '0xuser3', 4)

    expect(result.avg_rating).toBe(4)
  })
})
