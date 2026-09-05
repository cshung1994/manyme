import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import type { AgentRow, CreateAgentInput, UpdateAgentInput, AgentStats } from '../../types/index.js'

export function listAgents(filters?: { category?: string; creatorWallet?: string; q?: string; limit?: number }): AgentRow[] {
  const db = getDb()
  let sql = 'SELECT * FROM agents WHERE active = 1'
  const params: Record<string, string | number> = {}

  if (filters?.category) {
    sql += ' AND category = $category'
    params.$category = filters.category
  }
  if (filters?.creatorWallet) {
    sql += ' AND creator_wallet = $creator'
    params.$creator = filters.creatorWallet
  }
  if (filters?.q) {
    sql += ' AND (name LIKE $q OR description LIKE $q)'
    params.$q = `%${filters.q}%`
  }

  sql += ' ORDER BY run_count DESC, created_at DESC'

  if (filters?.limit) {
    sql += ' LIMIT $limit'
    params.$limit = filters.limit
  }

  return db.prepare(sql).all(params) as AgentRow[]
}

export function getAgentById(id: string): AgentRow | null {
  const row = getDb().prepare('SELECT * FROM agents WHERE id = $id').get({ $id: id }) as AgentRow | undefined
  return row ?? null
}

export function createAgent(input: CreateAgentInput): AgentRow {
  const db = getDb()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO agents (id, onchain_agent_id, creator_wallet, name, description, category,
      system_prompt, raw_system_prompt, user_prompt_template, model, temperature, max_tokens,
      tools_json, input_schema_json, rate_per_second, metadata_uri)
    VALUES ($id, $onchainAgentId, $creatorWallet, $name, $description, $category,
      $systemPrompt, $rawSystemPrompt, $userPromptTemplate, $model, $temperature, $maxTokens,
      $toolsJson, $inputSchemaJson, $ratePerSecond, $metadataUri)
  `).run({
    $id: id,
    $onchainAgentId: input.onchainAgentId ?? null,
    $creatorWallet: input.creatorWallet,
    $name: input.name,
    $description: input.description,
    $category: input.category ?? 'general',
    $systemPrompt: input.systemPrompt,
    $rawSystemPrompt: input.rawSystemPrompt ?? null,
    $userPromptTemplate: input.userPromptTemplate ?? null,
    $model: input.model ?? 'gemini-2.5-flash',
    $temperature: input.temperature ?? 0.3,
    $maxTokens: input.maxTokens ?? 1024,
    $toolsJson: input.toolsJson ?? null,
    $inputSchemaJson: input.inputSchemaJson ?? null,
    $ratePerSecond: input.ratePerSecond ?? 0,
    $metadataUri: input.metadataUri ?? null,
  })

  return getAgentById(id)!
}

export function updateAgent(id: string, input: UpdateAgentInput & { creatorWallet: string }): AgentRow {
  const existing = getAgentById(id)
  if (!existing) throw new Error(`Agent ${id} not found`)
  if (existing.creator_wallet !== input.creatorWallet) throw new Error('Not authorized')

  const db = getDb()
  db.prepare(`
    UPDATE agents SET
      name = $name, description = $description, category = $category,
      system_prompt = $systemPrompt, user_prompt_template = $userPromptTemplate,
      model = $model, temperature = $temperature, max_tokens = $maxTokens,
      tools_json = $toolsJson, input_schema_json = $inputSchemaJson,
      rate_per_second = $ratePerSecond, metadata_uri = $metadataUri,
      updated_at = datetime('now')
    WHERE id = $id
  `).run({
    $id: id,
    $name: input.name ?? existing.name,
    $description: input.description ?? existing.description,
    $category: input.category ?? existing.category,
    $systemPrompt: input.systemPrompt ?? existing.system_prompt,
    $userPromptTemplate: input.userPromptTemplate ?? existing.user_prompt_template,
    $model: input.model ?? existing.model,
    $temperature: input.temperature ?? existing.temperature,
    $maxTokens: input.maxTokens ?? existing.max_tokens,
    $toolsJson: input.toolsJson ?? existing.tools_json,
    $inputSchemaJson: input.inputSchemaJson ?? existing.input_schema_json,
    $ratePerSecond: input.ratePerSecond ?? existing.rate_per_second,
    $metadataUri: input.metadataUri ?? existing.metadata_uri,
  })

  return getAgentById(id)!
}

export function deactivateAgent(id: string, creatorWallet: string): void {
  getDb().prepare(
    "UPDATE agents SET active = 0, updated_at = datetime('now') WHERE id = $id AND creator_wallet = $wallet",
  ).run({ $id: id, $wallet: creatorWallet })
}

export function incrementRunCount(id: string): void {
  getDb().prepare('UPDATE agents SET run_count = run_count + 1 WHERE id = $id').run({ $id: id })
}

export function rateAgent(id: string, userWallet: string, rating: number): { avg_rating: number } {
  const db = getDb()

  db.prepare(`
    INSERT INTO agent_ratings (id, agent_id, user_wallet, rating)
    VALUES ($id, $agentId, $wallet, $rating)
    ON CONFLICT(agent_id, user_wallet) DO UPDATE SET rating = $rating, created_at = datetime('now')
  `).run({
    $id: randomUUID(),
    $agentId: id,
    $wallet: userWallet.toLowerCase(),
    $rating: rating,
  })

  const stats = db.prepare(
    'SELECT AVG(rating) as avg FROM agent_ratings WHERE agent_id = $agentId',
  ).get({ $agentId: id }) as { avg: number }

  db.prepare(
    "UPDATE agents SET avg_rating = $avg, updated_at = datetime('now') WHERE id = $id",
  ).run({ $id: id, $avg: stats.avg })

  return { avg_rating: Math.round(stats.avg * 10) / 10 }
}

export function getUserRating(id: string, userWallet: string): number | null {
  const row = getDb().prepare(
    'SELECT rating FROM agent_ratings WHERE agent_id = $agentId AND user_wallet = $wallet',
  ).get({ $agentId: id, $wallet: userWallet.toLowerCase() }) as { rating: number } | undefined

  return row?.rating ?? null
}

export function getAgentStats(id: string): AgentStats {
  const agent = getAgentById(id)
  if (!agent) return { run_count: 0, avg_rating: null, total_earned: 0 }

  return {
    run_count: agent.run_count,
    avg_rating: agent.avg_rating,
    total_earned: 0, // TODO: derive from curator_earnings table
  }
}
