import { getDb } from './client.js'
import { randomUUID } from 'crypto'

export function migrate(): void {
  const db = getDb()

  const skillsBefore = (db.query('SELECT COUNT(*) as cnt FROM skills').get() as { cnt: number }).cnt
  const agentsBefore = (db.query('SELECT COUNT(*) as cnt FROM agents').get() as { cnt: number }).cnt
  const execsBefore = (db.query('SELECT COUNT(*) as cnt FROM skill_executions').get() as { cnt: number }).cnt
  const ratingsBefore = (db.query('SELECT COUNT(*) as cnt FROM skill_ratings').get() as { cnt: number }).cnt
  console.log(`Before migration: ${skillsBefore} skills, ${agentsBefore} old agents, ${execsBefore} executions, ${ratingsBefore} ratings`)

  const insertAgent = db.prepare(`
    INSERT OR IGNORE INTO agents (
      id, onchain_agent_id, creator_wallet, name, description, category,
      system_prompt, raw_system_prompt, user_prompt_template,
      model, temperature, max_tokens, tools_json, input_schema_json,
      rate_per_second, avg_rating, run_count, migrated_from, metadata_uri, active
    ) VALUES (
      $id, $onchain_agent_id, $creator_wallet, $name, $description, $category,
      $system_prompt, $raw_system_prompt, $user_prompt_template,
      $model, $temperature, $max_tokens, $tools_json, $input_schema_json,
      $rate_per_second, $avg_rating, $run_count, $migrated_from, $metadata_uri, $active
    )
  `)

  const insertExecution = db.prepare(`
    INSERT OR IGNORE INTO agent_executions (
      id, agent_id, user_wallet, session_id, input_json, output_text,
      output_metadata_json, status, error_message, duration_ms, tokens_used,
      amount_charged, created_at, completed_at
    ) VALUES (
      $id, $agent_id, $user_wallet, $session_id, $input_json, $output_text,
      $output_metadata_json, $status, $error_message, $duration_ms, $tokens_used,
      $amount_charged, $created_at, $completed_at
    )
  `)

  const insertRating = db.prepare(`
    INSERT OR IGNORE INTO agent_ratings (id, agent_id, user_wallet, rating, created_at)
    VALUES ($id, $agent_id, $user_wallet, $rating, $created_at)
  `)

  db.transaction(() => {
    const skills = db.query('SELECT * FROM skills').all() as any[]
    for (const s of skills) {
      insertAgent.run({
        $id: s.id,
        $onchain_agent_id: null,
        $creator_wallet: s.creator_wallet,
        $name: s.name,
        $description: s.description,
        $category: s.category || 'general',
        $system_prompt: s.system_prompt,
        $raw_system_prompt: s.raw_system_prompt ?? null,
        $user_prompt_template: s.user_prompt_template ?? null,
        $model: s.model || 'gemini-2.0-flash',
        $temperature: s.temperature ?? 0.3,
        $max_tokens: s.max_tokens ?? 1024,
        $tools_json: s.tools_json ?? null,
        $input_schema_json: s.input_schema_json ?? null,
        $rate_per_second: s.rate_per_second ?? 100,
        $avg_rating: s.avg_rating ?? null,
        $run_count: s.run_count ?? 0,
        $migrated_from: 'skill',
        $metadata_uri: s.metadata_uri ?? null,
        $active: s.active ?? 1,
      })
    }
    console.log(`Migrated ${skills.length} skills`)

    const oldAgents = db.query('SELECT * FROM agents').all() as any[]
    const oldIdToNewUuid = new Map<number, string>()
    for (const a of oldAgents) {
      const newId = randomUUID()
      oldIdToNewUuid.set(a.id, newId)
      let config: any = {}
      try { config = JSON.parse(a.skill_config_json || '{}') } catch {}
      insertAgent.run({
        $id: newId,
        $onchain_agent_id: a.onchain_agent_id ?? null,
        $creator_wallet: a.curator_wallet,
        $name: a.name,
        $description: a.description,
        $category: a.category || 'defi',
        $system_prompt: config.systemPrompt || `You are ${a.name}. ${a.description}`,
        $raw_system_prompt: null,
        $user_prompt_template: null,
        $model: config.model || 'gemini-2.0-flash',
        $temperature: config.temperature ?? 0.3,
        $max_tokens: 1024,
        $tools_json: config.tools ? JSON.stringify(config.tools) : null,
        $input_schema_json: null,
        $rate_per_second: a.curator_rate_per_second ?? 100,
        $avg_rating: null,
        $run_count: 0,
        $migrated_from: 'agent',
        $metadata_uri: a.metadata_uri ?? null,
        $active: a.active ?? 1,
      })
    }
    console.log(`Migrated ${oldAgents.length} old agents`)

    const execs = db.query('SELECT * FROM skill_executions').all() as any[]
    for (const e of execs) {
      insertExecution.run({
        $id: e.id,
        $agent_id: e.skill_id,
        $user_wallet: e.user_wallet,
        $session_id: e.session_id ?? null,
        $input_json: e.input_json ?? null,
        $output_text: e.output_text ?? null,
        $output_metadata_json: e.output_metadata_json ?? null,
        $status: e.status || 'completed',
        $error_message: e.error_message ?? null,
        $duration_ms: e.duration_ms ?? null,
        $tokens_used: e.tokens_used ?? null,
        $amount_charged: e.amount_charged ?? 0,
        $created_at: e.created_at,
        $completed_at: e.completed_at ?? null,
      })
    }
    console.log(`Migrated ${execs.length} skill_executions`)

    const ratings = db.query('SELECT * FROM skill_ratings').all() as any[]
    for (const r of ratings) {
      insertRating.run({
        $id: r.id,
        $agent_id: r.skill_id,
        $user_wallet: r.user_wallet,
        $rating: r.rating,
        $created_at: r.created_at,
      })
    }
    console.log(`Migrated ${ratings.length} skill_ratings`)

    if (oldIdToNewUuid.size > 0) {
      const updateSession = db.prepare('UPDATE sessions SET agent_id = $newId WHERE agent_id = $oldId')
      for (const [oldId, newId] of oldIdToNewUuid) {
        updateSession.run({ $newId: newId, $oldId: String(oldId) })
      }
      console.log(`Updated session agent_id mappings for ${oldIdToNewUuid.size} old agents`)
    }
  })()

  const agentsAfter = (db.query('SELECT COUNT(*) as cnt FROM agents').get() as { cnt: number }).cnt
  const execsAfter = (db.query('SELECT COUNT(*) as cnt FROM agent_executions').get() as { cnt: number }).cnt
  const ratingsAfter = (db.query('SELECT COUNT(*) as cnt FROM agent_ratings').get() as { cnt: number }).cnt
  console.log(`After migration: ${agentsAfter} agents, ${execsAfter} agent_executions, ${ratingsAfter} agent_ratings`)
  console.log('Migration complete ✓')
}

if (import.meta.main) {
  migrate()
}
