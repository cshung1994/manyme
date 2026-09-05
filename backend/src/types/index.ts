export type SessionState = 'created' | 'active' | 'paused' | 'stopped' | 'failed';

export interface AgentRow {
  id: string;
  onchain_agent_id: number | null;
  creator_wallet: string;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  raw_system_prompt: string | null;
  user_prompt_template: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  tools_json: string | null;
  input_schema_json: string | null;
  rate_per_second: number;
  avg_rating: number | null;
  run_count: number;
  migrated_from: string | null;
  metadata_uri: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  creatorWallet: string;
  name: string;
  description: string;
  category?: string;
  systemPrompt: string;
  rawSystemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  toolsJson?: string;
  inputSchemaJson?: string;
  ratePerSecond?: number;
  metadataUri?: string;
  onchainAgentId?: number;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  category?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  toolsJson?: string;
  inputSchemaJson?: string;
  ratePerSecond?: number;
  metadataUri?: string;
}

export interface AgentStats {
  run_count: number;
  avg_rating: number | null;
  total_earned: number;
}

export interface AgentExecutionRow {
  id: string;
  agent_id: string;
  user_wallet: string;
  session_id: string | null;
  input_json: string | null;
  output_text: string | null;
  output_metadata_json: string | null;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  amount_charged: number;
  created_at: string;
  completed_at: string | null;
}

export interface AgentRatingRow {
  id: string;
  agent_id: string;
  user_wallet: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type SkillRow = AgentRow;
export type CreateSkillInput = CreateAgentInput;
export type UpdateSkillInput = UpdateAgentInput;
export type SkillExecutionRow = AgentExecutionRow;
