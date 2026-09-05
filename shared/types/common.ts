export enum Status { Created = 0, Active = 1, Paused = 2, Stopped = 3 }

export interface AgentSkillConfig {
  name: string;
  description: string;
  curator: string;
  category: string;
  curatorRatePerSecond: bigint;
  systemPrompt: string;
  model: "gemini-2.0-flash" | "gemini-2.5-pro-exp-03-25";
  temperature: number;
  tools: ToolConfig[];
  allowedChains: string[];
  outputFormat: "streaming" | "report" | "both";
  analysisTemplates: string[];
  maxSessionDuration: number;
}

export interface ToolConfig {
  type: "onchainos-market" | "onchainos-trade" | "onchainos-wallet" | "rpc-read";
  description: string;
  params?: Record<string, unknown>;
}

export interface AgentStep {
  ts: string;
  kind: "api" | "rpc" | "metric" | "commentary" | "finding";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ProofPackage {
  sessionId: string;
  seq: number;
  intervalStart: string;
  intervalEnd: string;
  onchainOSCalls: Array<{ api: string; endpoint: string; resultHash: string }>;
  computedMetrics: Record<string, string | number>;
  outputChunkHash: string;
  stepCount: number;
}

export interface Session {
  id: string;
  onchainSessionId: bigint;
  agentId: bigint;
  userWallet: string;
  status: Status;
  totalRatePerSecond: bigint;
  curatorRate: bigint;
  platformFee: bigint;
  depositAmount: bigint;
  startedAt?: string;
  endedAt?: string;
}
