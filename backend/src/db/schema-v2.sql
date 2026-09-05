CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onchain_agent_id INTEGER,
  curator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'defi',
  curator_rate_per_second INTEGER NOT NULL,
  skill_config_json TEXT NOT NULL,
  metadata_uri TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents_v2 (
  id TEXT PRIMARY KEY,
  onchain_agent_id INTEGER UNIQUE,
  creator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  system_prompt TEXT NOT NULL,
  raw_system_prompt TEXT,
  user_prompt_template TEXT,
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  temperature REAL NOT NULL DEFAULT 0.3,
  max_tokens INTEGER NOT NULL DEFAULT 1024,
  tools_json TEXT,
  input_schema_json TEXT,
  rate_per_second INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL,
  run_count INTEGER NOT NULL DEFAULT 0,
  migrated_from TEXT,
  metadata_uri TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agents_v2_category ON agents_v2(category);
CREATE INDEX IF NOT EXISTS idx_agents_v2_creator_wallet ON agents_v2(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_agents_v2_active ON agents_v2(active);
CREATE INDEX IF NOT EXISTS idx_agents_v2_run_count ON agents_v2(run_count);

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents_v2(id),
  user_wallet TEXT NOT NULL,
  session_id TEXT,
  input_json TEXT,
  output_text TEXT,
  output_metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  tokens_used INTEGER,
  amount_charged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_ratings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents_v2(id),
  user_wallet TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, user_wallet)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  onchain_session_id INTEGER,
  agent_id TEXT NOT NULL REFERENCES agents_v2(id),
  user_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  total_rate INTEGER NOT NULL,
  curator_rate INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  proof_hash TEXT NOT NULL,
  metadata_uri TEXT,
  tx_hash TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curator_earnings (
  id TEXT PRIMARY KEY,
  curator_wallet TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents_v2(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  earned_amount INTEGER NOT NULL,
  paid_out INTEGER NOT NULL DEFAULT 0,
  payout_tx_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_curator_earnings_wallet ON curator_earnings(curator_wallet);

CREATE TABLE IF NOT EXISTS query_sales (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents_v2(id),
  route TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  amount_usdc TEXT NOT NULL,
  receipt_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id),
  creator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  system_prompt TEXT NOT NULL,
  raw_system_prompt TEXT,
  user_prompt_template TEXT,
  model TEXT DEFAULT 'gemini-2.0-flash',
  temperature REAL DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 1024,
  tools_json TEXT,
  input_schema_json TEXT,
  price_per_run INTEGER DEFAULT 0,
  rate_per_second INTEGER,
  execution_mode TEXT DEFAULT 'once',
  active INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,
  avg_rating REAL,
  metadata_uri TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_creator ON skills(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_skills_agent ON skills(agent_id);

CREATE TABLE IF NOT EXISTS skill_executions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  user_wallet TEXT NOT NULL,
  session_id TEXT REFERENCES sessions(id),
  input_json TEXT,
  output_text TEXT,
  output_metadata_json TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  tokens_used INTEGER,
  amount_charged INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_skill ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON skill_executions(user_wallet);

CREATE TABLE IF NOT EXISTS skill_ratings (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  user_wallet TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(skill_id, user_wallet)
);

CREATE INDEX IF NOT EXISTS idx_ratings_skill ON skill_ratings(skill_id);

CREATE TABLE IF NOT EXISTS user_balances (
  wallet TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  total_deposited INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- On-chain verified deposits (tx_hash unique = replay protection)
CREATE TABLE IF NOT EXISTS deposits (
  tx_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
