# ManyMe — Architecture Document

**AI Agent Marketplace with Streaming Salary on Base**

> Three parties. One payment stream. Curators upload agents, users consume them per-second, the platform hosts and settles.

**Target**: Base OnchainOS AI Hackathon (40,000 USDT)  
**Team**: 2 devs, 7–10 days  
**Stack**: Next.js + Solidity + Node.js + OnchainOS APIs  

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [Three-Party Model](#2-three-party-model)
3. [System Architecture](#3-system-architecture)
4. [Smart Contracts](#4-smart-contracts)
5. [Backend Services](#5-backend-services)
6. [Agent Runtime](#6-agent-runtime)
7. [Frontend Architecture](#7-frontend-architecture)
8. [x402 Integration](#8-x402-integration)
9. [On-Chain Transaction Strategy](#9-on-chain-transaction-strategy)
10. [Project File Structure](#10-project-file-structure)
11. [10-Day Build Plan](#11-10-day-build-plan)
12. [Risk Mitigation](#12-risk-mitigation)
13. [Demo Choreography](#13-demo-choreography)

---

## 1. Product Definition

### 1.1 One-Liner

> An AI agent marketplace where curators upload skill configs, users pay per-second to use agents, and the platform hosts everything — with on-chain proof that work actually happens.

### 1.2 Three Roles

| Role | What They Do | Revenue |
|---|---|---|
| **Agent Curator** | Uploads agent skill configs (system prompt, tools, params). Sets pricing. | Earns curator rate per second of usage |
| **Platform (us)** | Hosts unified LLM runtime, spawns instances, manages billing, submits proofs | Earns platform fee per second of usage |
| **User** | Browses agent catalog, selects agent, starts streaming session, pays per-second | Pays total rate (curator + platform fee) |

### 1.3 Payment Model

```
User pays:  $0.0013/sec (total)
            ├── $0.001/sec  → Curator rate (curator-defined)
            └── $0.0003/sec → Platform fee (platform-defined)

On-chain:   User ──USDC──► Platform Escrow Contract
                                 │
                                 │  session end / claim
                                 ▼
                            Platform Wallet (on-chain)
                                 │
Off-chain:                       │  batch settlement
                                 ▼
                            Curator Wallet (periodic payout)
```

### 1.4 Why Base

| Advantage | Detail |
|---|---|
| **Near-zero gas** | ETH gas negligible — proof submissions < $0.001 each |
| **Flashblocks** | 200ms preconfirmation for near-instant UX |
| **OnchainOS APIs** | Market/Trade/Wallet APIs for agent data |
| **x402 native** | EVM-equivalent, EIP-3009 works directly |
| **WebSocket** | `` for real-time events |
| **$40K prize pool** | 4× Circle Arc hackathon |

### 1.5 MVP Scope

**Build:**
- Agent Registry — curators upload skill configs with pricing
- Agent Catalog — users browse and select agents
- Streaming session — per-second billing with proof-gated accrual
- Platform escrow contract on Base
- Live dashboard — work output + salary counter + proof timeline
- x402-gated spot query endpoint
- Curator earnings dashboard
- 50+ on-chain transactions in demo

**Do NOT build:**
- Semantic proof verification on-chain
- Real VM isolation (use shared LLM runtime for hackathon)
- Automated curator payouts on-chain (manual/batch for hackathon)
- Agent ratings/reviews system
- Support for >3 agent templates

### 1.6 Hackathon Requirements Mapping

| Requirement | How We Satisfy |
|---|---|
| TX Hash on Base mainnet | Escrow deposits + proof submissions + claims |
| OnchainOS APIs | Agent instances use Market/Trade/Wallet APIs |
| x402 integration | Spot query paywall |
| AI model integration | Unified LLM runtime loading curator skill configs |
| GitHub repo | This repo |
| Project X account | Created for submission |

---

## 2. Three-Party Model

### 2.1 Lifecycle

```
PHASE 1: Curator Onboarding
──────────────────────────
Curator → Platform API:
  - Upload agent skill config (system prompt, tools, params)
  - Set curator rate ($0.001/sec)
  - Agent appears in catalog

PHASE 2: User Discovery & Session
──────────────────────────────────
User → Browse catalog → Select "DeFi Pool Analyst" ($0.0013/sec total)
User → Deposit USDC to escrow contract
User → Start session → Platform spawns agent instance

PHASE 3: Streaming Work
────────────────────────
Agent instance runs on platform LLM runtime:
  - Loads curator's skill config
  - Fetches data via OnchainOS APIs
  - Produces analysis output → streams to user dashboard
  - Platform submits proof-of-work every 3-5 seconds
  - Salary accrues per-second in escrow contract

PHASE 4: Settlement
────────────────────
Session ends (user stops / deposit exhausted / timeout):
  - Platform claims accrued USDC from escrow (on-chain)
  - Platform records curator's share (off-chain)
  - Curator sees earnings in dashboard
  - Platform batch-settles to curator periodically
```

### 2.2 Agent as Skill Config

Curators do NOT upload code. They upload a **skill configuration**:

```typescript
interface AgentSkillConfig {
  // Identity
  name: string;                    // "DeFi Pool Analyst"
  description: string;             // What this agent does
  curator: `0x${string}`;         // Curator wallet (for payouts)
  category: string;                // "defi" | "trading" | "research"

  // Pricing
  curatorRatePerSecond: bigint;   // In USDC smallest units

  // AI Configuration
  systemPrompt: string;            // The core instructions
  model: "gemini-2.0-flash" | "gemini-2.5-pro-exp-03-25"; // Preferred model
  temperature: number;

  // Tools & Data Access
  tools: ToolConfig[];             // Which OnchainOS APIs + RPC methods
  allowedChains: string[];         // Which chains the agent can read

  // Capabilities
  outputFormat: "streaming" | "report" | "both";
  analysisTemplates: string[];     // ["pool-snapshot", "yield-compare"]
  maxSessionDuration: number;      // Seconds (0 = unlimited)
}

interface ToolConfig {
  type: "onchainos-market" | "onchainos-trade" | "onchainos-wallet" | "rpc-read";
  description: string;
  params?: Record<string, unknown>;
}
```

The platform's unified LLM runtime takes this config and creates an agent instance that:
- Uses the curator's system prompt
- Has access to the specified tools only
- Outputs in the specified format
- Runs within the specified constraints

### 2.3 Multi-Tenancy

Same agent config → multiple simultaneous instances:

```
"DeFi Pool Analyst" (by Curator A)
    ├── Instance #1 → User X session (analyzing ETH/USDC pool)
    ├── Instance #2 → User Y session (analyzing ETH/USDT pool)
    └── Instance #3 → User Z session (analyzing BTC/USDC pool)

Each instance:
  - Independent session + proof stream
  - Independent escrow deposit
  - Shares the same skill config
  - Runs on platform LLM runtime
```

---

## 3. System Architecture

### 3.1 System Diagram

```
┌──────────────────────── FRONTEND (Next.js) ─────────────────────────────┐
│                                                                          │
│  Curator Dashboard       User Marketplace       Live Session Page        │
│  - upload skill config   - browse agents        - agent worklog          │
│  - set pricing           - filter by category   - salary ticker          │
│  - view earnings         - see rates + desc     - proof timeline         │
│  - payout history        - select + deposit     - stream controls        │
│                          - start session        - cost breakdown         │
│                                                                          │
│  Spot Query Page                                                         │
│  - x402 paywall                                                          │
│  - paid response viewer                                                  │
│                                                                          │
└──────┬──────────────────────┬────────────────────────┬──────────────────┘
       │ REST / SSE           │ viem reads              │ HTTP / x402
       ▼                      ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js / TypeScript)                      │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Agent Registry  │ │ Session        │ │ Proof Worker │ │ x402       │ │
│  │                 │ │ Orchestrator   │ │ / Relayer    │ │ Paywall    │ │
│  │ CRUD agents     │ │                │ │              │ │            │ │
│  │ catalog API     │ │ spawn instance │ │ build proof  │ │ spot query │ │
│  │ curator auth    │ │ manage lifecycle│ │ submit tx   │ │ endpoints  │ │
│  └────────┬────────┘ └───────┬────────┘ └──────┬───────┘ └─────┬──────┘ │
│           │                  │                  │               │        │
│  ┌────────▼──────────────────▼──────────────────▼───────────────▼──────┐ │
│  │                    Instance Manager                                 │ │
│  │  - Load skill config from registry                                  │ │
│  │  - Spin up LLM session with curator's prompt + tools                │ │
│  │  - Route OnchainOS API calls through platform credentials           │ │
│  │  - Emit work steps → SSE → frontend                                 │ │
│  │  - Package proofs → Proof Worker → on-chain                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────────────┐ │
│  │ Settlement      │ │ Event Indexer  │ │ OnchainOS Data Layer         │ │
│  │ Service         │ │                │ │                              │ │
│  │ track curator   │ │ watch contract │ │ Market API → prices, pools   │ │
│  │ earnings        │ │ events via WS  │ │ Trade API → DEX quotes       │ │
│  │ batch payouts   │ │                │ │ Wallet API → balances        │ │
│  └────────────────┘ └────────────────┘ └──────────────────────────────┘ │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐                                  │
│  │ Persistence     │ │ Object Storage │                                  │
│  │ (SQLite)        │ │ (proof pkgs)   │                                  │
│  └────────────────┘ └────────────────┘                                  │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ contract writes / reads
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   BASE (Chain ID: 8453, OP Stack)                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ManyMeEscrow.sol                                               │  │
│  │  ─────────────────                                                 │  │
│  │  Agent Registry: agentId → curator, curatorRate, active            │  │
│  │  Sessions: user, agentId, totalRate, proofWindow, deposit, accrued │  │
│  │  Proofs: proofHash + liveness check                                │  │
│  │  Settlement: platform wallet claims accrued USDC                   │  │
│  │  Payment Token: USDC (bridged ERC-20)                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  RPC: https://mainnet.base.org                                            │
│  WS:                                              │
│  Flashblocks: https://mainnet.base.org/flashblocks                        │
│  Explorer: https://basescan.org                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
① Curator uploads skill config → stored in Agent Registry (off-chain DB)
   Optional: registerAgent() on-chain (agentId, curator wallet, curatorRate)

② User browses catalog → selects agent → deposits USDC
   → createSession(agentId, depositAmount) on Base escrow contract

③ Contract emits SessionStarted
   → Event Indexer picks up
   → Instance Manager loads skill config for agentId
   → Spawns LLM session with curator's prompt + tools

④ Agent work loop (every 3-5 seconds):
   → OnchainOS APIs → data
   → LLM analysis → structured output
   → Push to dashboard via SSE
   → Proof Worker builds proof package
   → submitProof(sessionId, proofHash) on Base

⑤ Salary accrues per-second in contract:
   claimable = ratePerSecond × validActiveTime
   (capped by proof freshness + deposit balance)

⑥ If proof stops (> proofWindow):
   → Anyone calls enforceProofTimeout()
   → Contract auto-pauses → salary stops
   → Dashboard: "PAUSED: No Proof"

⑦ Session ends → Platform claims accrued USDC on-chain
   → Settlement Service records curator's share
   → Curator sees earnings in dashboard
   → Batch payout to curator wallet (off-chain / periodic on-chain)
```

---

## 4. Smart Contracts

### 4.1 Design Principles

- **One contract** — `ManyMeEscrow.sol` handles agent registry, sessions, proofs, and settlement
- **Platform is the counterparty** — user pays platform, not curator directly
- **Lazy accrual** — salary computed mathematically per-second, NOT one tx per second
- **Proof = liveness** — on-chain checks timing + hash presence; semantic verification off-chain
- **Anyone can trigger timeout** — permissionless, no keeper dependency
- **Agent registry on-chain** — curators register agents with their wallet + rate (enables transparent marketplace)

### 4.2 ManyMeEscrow.sol

#### State Model

```solidity
// ═══════════════════════════════════════════
// Agent Registry (curator-facing)
// ═══════════════════════════════════════════

struct Agent {
    address curator;              // Curator's wallet (for settlement tracking)
    uint96  curatorRatePerSecond;  // Curator's rate in USDC units
    string  metadataURI;          // IPFS/HTTP pointer to full skill config JSON
    bool    active;               // Can users start sessions?
}

mapping(uint256 => Agent) public agents;
uint256 public nextAgentId;

// ═══════════════════════════════════════════
// Sessions (user-facing)
// ═══════════════════════════════════════════

enum Status { Created, Active, Paused, Stopped }

struct Session {
    // Parties
    uint256 agentId;
    address user;

    // Rates
    uint96  totalRatePerSecond;   // curatorRate + platformFee
    uint96  curatorRate;          // Curator's portion
    uint96  platformFee;          // Platform's portion

    // Proof config
    uint40  proofWindow;          // Max seconds between proofs
    uint40  minProofInterval;     // Min seconds between proofs (anti-spam)

    // Timestamps
    uint40  startedAt;
    uint40  lastCheckpointAt;
    uint40  lastProofAt;

    // Financials (in USDC smallest units)
    uint128 depositedBalance;
    uint128 accruedTotal;         // Total earned (platform claims this)
    uint128 totalClaimed;         // Already claimed by platform

    Status  status;
}

mapping(uint256 => Session) public sessions;
uint256 public nextSessionId;

// ═══════════════════════════════════════════
// Platform config
// ═══════════════════════════════════════════

address public platformWallet;
uint96  public platformFeeRate;   // Platform's per-second fee
address public paymentToken;      // USDC on Base
```

#### Accrual Logic

On any state-changing call, run `_checkpoint(sessionId)`:

```
if status == Active:
    // Cap by proof freshness
    effectiveEnd = min(block.timestamp, lastProofAt + proofWindow)
    validElapsed = max(0, effectiveEnd - lastCheckpointAt)

    // Calculate accrual
    newAccrual = validElapsed * totalRatePerSecond

    // Cap by remaining deposit
    remaining = depositedBalance - accruedTotal
    newAccrual = min(newAccrual, remaining)

    accruedTotal += newAccrual
    lastCheckpointAt = block.timestamp

    // Auto-pause if deposit exhausted
    if accruedTotal >= depositedBalance:
        status = Paused
        emit DepositExhausted(sessionId)
```

**Key**: Salary only accrues while `now <= lastProofAt + proofWindow`. Agent stops proving → accrual stops automatically.

#### Function Signatures

```solidity
interface IManyMeEscrow {
    // ═══ Agent Registry (Curator) ═══
    function registerAgent(
        uint96  curatorRatePerSecond,
        string  calldata metadataURI
    ) external returns (uint256 agentId);

    function updateAgent(
        uint256 agentId,
        uint96  curatorRatePerSecond,
        string  calldata metadataURI
    ) external;

    function deactivateAgent(uint256 agentId) external;

    // ═══ Sessions (User) ═══
    function createSession(
        uint256 agentId,
        uint128 depositAmount
    ) external returns (uint256 sessionId);

    function topUp(uint256 sessionId, uint128 amount) external;
    function stopSession(uint256 sessionId) external;

    // ═══ Proof (Platform only) ═══
    function submitProof(
        uint256 sessionId,
        bytes32 proofHash,
        string  calldata metadataURI
    ) external;

    function enforceProofTimeout(uint256 sessionId) external; // Anyone

    // ═══ Settlement (Platform only) ═══
    function claimEarnings(uint256 sessionId) external returns (uint128 amount);
    function claimMultiple(uint256[] calldata sessionIds) external returns (uint128 total);

    // ═══ Refund (User) ═══
    function refundUnused(uint256 sessionId) external returns (uint128 amount);

    // ═══ Views ═══
    function getAgent(uint256 agentId) external view returns (Agent memory);
    function getSession(uint256 sessionId) external view returns (Session memory);
    function accruedAvailable(uint256 sessionId) external view returns (uint128);
    function userCostSoFar(uint256 sessionId) external view returns (uint128);
    function sessionRate(uint256 agentId) external view returns (uint96 total, uint96 curator, uint96 platform);
}
```

#### Access Control

| Function | Caller | Notes |
|---|---|---|
| `registerAgent` | Anyone (becomes curator) | |
| `updateAgent`, `deactivateAgent` | Curator of that agent | |
| `createSession`, `topUp` | Any user | |
| `stopSession` | User of that session | |
| `submitProof` | **Platform only** (operator role) | Platform controls proof submission |
| `enforceProofTimeout` | **Anyone** | Permissionless timeout trigger |
| `claimEarnings`, `claimMultiple` | **Platform only** | Platform collects, settles off-chain |
| `refundUnused` | User (after session stopped) | |

#### Events

```solidity
// Agent Registry
event AgentRegistered(uint256 indexed agentId, address indexed curator,
    uint96 curatorRate, string metadataURI);
event AgentUpdated(uint256 indexed agentId, uint96 curatorRate, string metadataURI);
event AgentDeactivated(uint256 indexed agentId);

// Sessions
event SessionCreated(uint256 indexed sessionId, uint256 indexed agentId,
    address indexed user, uint128 deposit, uint96 totalRate);
event SessionStarted(uint256 indexed sessionId, uint40 startedAt);
event SessionStopped(uint256 indexed sessionId, uint128 totalAccrued, uint128 refunded);
event SessionToppedUp(uint256 indexed sessionId, uint128 amount);

// Proofs
event ProofSubmitted(uint256 indexed sessionId, bytes32 indexed proofHash,
    string metadataURI, uint40 submittedAt);
event ProofTimeout(uint256 indexed sessionId, uint40 lastProofAt, uint40 timeoutAt);

// Settlement
event EarningsClaimed(uint256 indexed sessionId, address indexed platformWallet,
    uint128 amount);
event DepositExhausted(uint256 indexed sessionId);
event FundsRefunded(uint256 indexed sessionId, address indexed user, uint128 amount);
```

#### Implementation Notes

- Use `SafeERC20` for all USDC transfers
- Pack struct fields (`uint40`, `uint96`, `uint128`) for gas optimization
- `claimEarnings()` calls `_checkpoint()` before transfer
- Store proof details in **events**, not storage (gas saving)
- `registerAgent()` is permissionless — anyone can become a curator
- `createSession()` auto-starts the session (no separate start step for simplicity)
- Platform fee rate is set at contract level, applies to all sessions

### 4.3 Demo Mode Settings

| Parameter | Demo | Production |
|---|---|---|
| `platformFeeRate` | 300 ($0.0003/sec) | Configurable |
| `proofWindow` | 10 seconds | 60-120 seconds |
| `minProofInterval` | 3 seconds | 15-30 seconds |
| Curator rate (example) | 1000 ($0.001/sec) | Curator-defined |

### 4.4 Contract Deployment

```bash
# Foundry
forge create src/ManyMeEscrow.sol:ManyMeEscrow \
  --constructor-args $PLATFORM_WALLET $PLATFORM_FEE_RATE $USDC_ADDRESS \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_KEY

# Verify on OKLink
forge verify-contract $CONTRACT_ADDRESS src/ManyMeEscrow.sol:ManyMeEscrow \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --etherscan-api-key $OKLINK_API_KEY
```

---

## 5. Backend Services

### 5.1 Stack

- **Runtime**: Node.js 20+ / TypeScript
- **Framework**: Hono or Express
- **Chain**: viem for Base reads/writes
- **DB**: SQLite (hackathon simplicity)
- **Real-time**: SSE for live agent output
- **OnchainOS**: REST API with HMAC-SHA256 auth

### 5.2 Modules

#### A. Agent Registry

Stores and serves curator-uploaded skill configs.

```typescript
// API
POST   /api/agents              — Register new agent (curator uploads config)
GET    /api/agents               — List all active agents (catalog)
GET    /api/agents/:id           — Get agent detail + config
PUT    /api/agents/:id           — Update agent config (curator only)
DELETE /api/agents/:id           — Deactivate agent (curator only)
GET    /api/agents/:id/stats     — Usage stats (sessions, earnings)
```

Curator auth: wallet signature verification (EIP-712 or simple message signing).

#### B. Instance Manager

Spawns and manages agent instances per session.

```typescript
interface AgentInstance {
  instanceId: string;
  sessionId: bigint;
  agentId: bigint;
  skillConfig: AgentSkillConfig;    // Loaded from registry
  status: "booting" | "running" | "paused" | "stopped";
  llmSessionId: string;             // LLM provider session
  createdAt: string;
}

// Core methods
spawnInstance(sessionId: bigint, agentId: bigint): Promise<AgentInstance>
pauseInstance(instanceId: string): Promise<void>
resumeInstance(instanceId: string): Promise<void>
stopInstance(instanceId: string): Promise<void>
```

How it works:
1. Receives `SessionCreated` event from chain
2. Loads skill config from Agent Registry by `agentId`
3. Creates LLM session with curator's system prompt + tool definitions
4. Starts the work loop (data fetch → analysis → output → proof)
5. Manages lifecycle in response to contract events

#### C. Session Orchestrator

Manages active sessions and coordinates between contract events + instances.

```typescript
// Listens to contract events:
SessionCreated  → instanceManager.spawnInstance()
ProofTimeout    → instanceManager.pauseInstance()
SessionStopped  → instanceManager.stopInstance() + settlement.record()
```

#### D. Proof Worker / Relayer

Same architecture as before, but proof submission is always from **platform's operator wallet** (not the agent/curator).

```typescript
interface ProofPackage {
  sessionId: string;
  seq: number;
  intervalStart: string;
  intervalEnd: string;
  onchainOSCalls: Array<{
    api: "market" | "trade" | "wallet";
    endpoint: string;
    resultHash: string;
  }>;
  computedMetrics: Record<string, string | number>;
  outputChunkHash: string;
  stepCount: number;
}
```

Every 3-5 seconds per active session:
1. Check if instance produced new work
2. Build proof package, hash it
3. Upload package to storage
4. Call `submitProof(sessionId, proofHash, metadataURI)` on-chain

#### E. Settlement Service

Tracks curator earnings off-chain. Handles batch payouts.

```typescript
interface CuratorEarnings {
  curatorWallet: string;
  agentId: bigint;
  totalEarned: bigint;           // Cumulative USDC earned
  totalPaidOut: bigint;          // Already sent to curator
  pendingPayout: bigint;         // totalEarned - totalPaidOut
  sessions: SessionEarning[];    // Per-session breakdown
}

interface SessionEarning {
  sessionId: bigint;
  duration: number;              // Seconds
  curatorRate: bigint;
  totalCuratorEarning: bigint;   // duration * curatorRate
  status: "active" | "settled";
}
```

For hackathon: show earnings in dashboard, manual/batch payout.  
For production: automated periodic on-chain transfers to curator wallets.

#### F. Event Indexer

Watches Base contract via WebSocket:

```typescript
const unwatch = publicClient.watchContractEvent({
  address: ESCROW_CONTRACT,
  abi: manymeEscrowAbi,
  onLogs: (logs) => {
    for (const log of logs) {
      switch (log.eventName) {
        case 'SessionCreated':  orchestrator.onSessionCreated(log.args); break;
        case 'ProofTimeout':    orchestrator.onProofTimeout(log.args); break;
        case 'SessionStopped':  orchestrator.onSessionStopped(log.args); break;
        case 'EarningsClaimed': settlement.onClaimed(log.args); break;
      }
    }
  }
});
```

### 5.3 OnchainOS API Integration

```typescript
// Authentication (HMAC-SHA256)
function signRequest(timestamp: string, method: string, path: string, body: string): string {
  const prehash = timestamp + method.toUpperCase() + path + body;
  return crypto.createHmac('sha256', OKX_SECRET_KEY).update(prehash).digest('base64');
}

// Headers: OK-ACCESS-KEY, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE, OK-ACCESS-SIGN
```

| API | Endpoint | Agent Use |
|---|---|---|
| Market | `/api/v5/market/tickers` | Token prices |
| Market | `/api/v5/market/candles` | Historical data |
| Trade | `/api/v5/dex/aggregator/quote` | DEX quotes |
| Wallet | `/api/v5/wallet/asset/balances` | Token balances |

### 5.4 Database Schema

```sql
-- Agent configs (curator-uploaded)
CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onchain_agent_id INTEGER,         -- ID from contract registerAgent()
  curator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  curator_rate_per_second INTEGER NOT NULL,
  skill_config_json TEXT NOT NULL,   -- Full AgentSkillConfig JSON
  metadata_uri TEXT,                 -- IPFS/HTTP pointer
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Active sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  onchain_session_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  user_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  total_rate INTEGER NOT NULL,
  curator_rate INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent work steps (live timeline)
CREATE TABLE session_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  step_type TEXT NOT NULL,           -- 'api' | 'rpc' | 'metric' | 'commentary' | 'finding'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Proof submissions
CREATE TABLE proofs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  proof_hash TEXT NOT NULL,
  metadata_uri TEXT,
  tx_hash TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Curator earnings tracking
CREATE TABLE curator_earnings (
  id TEXT PRIMARY KEY,
  curator_wallet TEXT NOT NULL,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  earned_amount INTEGER NOT NULL,    -- USDC units
  paid_out BOOLEAN DEFAULT FALSE,
  payout_tx_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- x402 query sales
CREATE TABLE query_sales (
  id TEXT PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  route TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  amount_usdc TEXT NOT NULL,
  receipt_ref TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Agent Runtime

### 6.1 Unified LLM Runtime

The platform runs ONE runtime that dynamically loads curator skill configs:

```
                    Instance Manager
                         │
                         │ load config
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Unified LLM Runtime                 │
│                                                      │
│  For each active session:                            │
│  ┌─────────────────────────────────────────────────┐│
│  │  Agent Instance #N                               ││
│  │                                                  ││
│  │  System Prompt: [from curator config]            ││
│  │  Tools: [from curator config]                    ││
│  │  Model: [from curator config]                    ││
│  │                                                  ││
│  │  Work Loop:                                      ││
│  │    1. Router: pick analysis template             ││
│  │    2. Data: OnchainOS API + RPC reads            ││
│  │    3. Metrics: code-computed (NOT LLM)           ││
│  │    4. Summary: LLM narrates findings             ││
│  │    5. Output: stream steps to SSE                ││
│  │    6. Proof: package hash → Proof Worker         ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 6.2 Pre-built Analysis Templates

Curators reference these in their skill config. Platform provides the implementations.

| Template ID | Description | Data Sources | Output |
|---|---|---|---|
| `pool-snapshot` | Analyze a DEX pool's health | Market API + RPC (slot0, liquidity) | TVL, volume, fee activity, risk flags |
| `yield-compare` | Compare yield across pools/vaults | Market API + RPC | Risk-adjusted ranking, trends |
| `token-flow` | Track token movement patterns | Wallet API + Trade API + RPC logs | Large transfers, whale activity |

### 6.3 Agent Step Format

```typescript
type AgentStep = {
  ts: string;
  kind: "api" | "rpc" | "metric" | "commentary" | "finding";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};
```

### 6.4 Proof Definition

Proof = **verifiable liveness + evidence anchoring** (NOT semantic correctness).

Every 3-5 seconds, the Proof Worker:
1. Collects all steps since last proof
2. Hashes: `keccak256(sessionId, seq, outputHash, dataSourcesHash, blockNumber)`
3. Uploads full proof package to storage
4. Submits hash on-chain

What it proves: agent produced measurable work in this interval.  
What it doesn't prove: the analysis is correct (that's off-chain judgment).

---

## 7. Frontend Architecture

### 7.1 Pages

```
/                       Landing — product explainer
/curator                Curator dashboard — upload agents, view earnings
/curator/agents/new     Upload new agent config
/curator/agents/[id]    Edit agent + view stats
/marketplace            User marketplace — browse + select agents
/session/[id]           Live work + salary stream (THE DEMO PAGE)
/query                  Spot query — x402 paywall
```

### 7.2 Real-Time Strategy

| Source | Transport | Data |
|---|---|---|
| Agent steps + proof events | **SSE** | AgentStep[], proof confirmations |
| On-chain state | **Polling** (viem, 2-3s) | accruedAvailable, session status |
| Salary ticker | **Optimistic local** | `display += rate` per 1s, reset on poll |

### 7.3 Key Components

```
/components/
├── wallet/
│   └── ConnectWalletButton.tsx
├── curator/
│   ├── AgentConfigForm.tsx         — Upload skill config + set pricing
│   ├── CuratorEarningsCard.tsx     — Total earned, pending payout
│   └── AgentStatsCard.tsx          — Sessions count, usage hours
├── marketplace/
│   ├── AgentCatalogGrid.tsx        — Browse all agents
│   ├── AgentCard.tsx               — Name, description, rate, curator
│   ├── AgentDetailModal.tsx        — Full description + start session CTA
│   └── CategoryFilter.tsx          — Filter by category
├── session/
│   ├── SessionControlPanel.tsx     — Deposit, start, stop, top-up
│   ├── SalaryTicker.tsx            — Animated USDC counter
│   ├── CostBreakdown.tsx           — "Curator: $X | Platform: $Y | Total: $Z"
│   ├── ProofHeartbeatTimeline.tsx  — Proof events timeline
│   ├── StreamStatusBadge.tsx       — RUNNING / PAUSED / STOPPED
│   ├── AgentWorkTimeline.tsx       — Live step-by-step output
│   └── MetricsGrid.tsx             — Computed metrics cards
└── query/
    ├── X402PaywallCard.tsx
    └── PaidResponseViewer.tsx
```

### 7.4 Demo Visual Moments

1. **Curator uploads agent** → appears in marketplace instantly
2. **User selects agent** → sees rate breakdown (curator + platform)
3. **Session starts** → salary counter ticking, work timeline populating
4. **Proof heartbeat** → green flash every 3s: "✓ Proof Anchored"
5. **THE MOMENT**: Kill instance → proof stops → counter FREEZES
6. **Recovery**: Restart → proof resumes → counter restarts
7. **Settlement**: Session ends → shows split: "Curator earned $X, Platform earned $Y"
8. **Spot query**: Public user pays $0.005 via x402 → instant unlock

---

## 8. x402 Integration

### 8.1 Role

x402 powers **spot queries** — anyone can pay to query an agent's accumulated analysis. Does NOT power the streaming salary.

### 8.2 Endpoints

| Route | Price | Description |
|---|---|---|
| `GET /queries/agent/:id/summary` | $0.001 | Brief analysis summary |
| `POST /queries/agent/:id/ask` | $0.003 | Ask a follow-up question |
| `GET /queries/agent/:id/evidence` | $0.005 | Full evidence package |

### 8.3 Implementation

Use [x402-gateway-template](https://github.com/azep-ninja/x402-gateway-template) or `@x402/express` middleware.

---

## 9. On-Chain Transaction Strategy

### Target: 50+ transactions

```
┌──────────────────────────┬─────────┬─────────────────────────────────┐
│ Transaction Type         │ Count   │ Detail                          │
├──────────────────────────┼─────────┼─────────────────────────────────┤
│ registerAgent            │ 2-3     │ Curators register agents        │
│ USDC approve             │ 2-3     │ Users approve escrow            │
│ createSession            │ 3-4     │ Users start sessions            │
│ topUp                    │ 1-2     │ Show funding mechanism          │
│ submitProof              │ 30-40   │ Every 3-5s for 2-3 minutes      │
│ enforceProofTimeout      │ 1-2     │ Permissionless timeout          │
│ claimEarnings            │ 3-5     │ Platform collects               │
│ stopSession              │ 2-3     │ Users end sessions              │
│ refundUnused             │ 1-2     │ User gets remaining deposit     │
│ x402 settlements         │ 5-8     │ Spot queries                    │
├──────────────────────────┼─────────┼─────────────────────────────────┤
│ TOTAL                    │ 50-72   │ Comfortably exceeds 50 ✓        │
└──────────────────────────┴─────────┴─────────────────────────────────┘
```

### Margin Explanation

> **Why Base**: Ethereum mainnet charges ~$0.50-2.00 per ERC-20 transfer. A single proof tx costs more than 500 seconds of agent salary. Base gas is near-zero — every second of agent work is profitable. Flashblocks give 200ms preconfirmation for real-time UX.

---

## 10. Project File Structure

```
manyme/
├── README.md
├── docs/
│   └── ARCHITECTURE.md
│
├── contracts/
│   ├── foundry.toml
│   ├── src/
│   │   ├── ManyMeEscrow.sol
│   │   └── interfaces/
│   │       └── IManyMeEscrow.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── test/
│       └── ManyMeEscrow.t.sol
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.ts
│       ├── config.ts
│       ├── api/
│       │   ├── agents.routes.ts        — Agent registry CRUD
│       │   ├── sessions.routes.ts      — Session management
│       │   ├── curator.routes.ts       — Curator earnings/stats
│       │   └── queries.routes.ts       — x402 paid queries
│       ├── services/
│       │   ├── registry/
│       │   │   └── agentRegistry.ts
│       │   ├── instance/
│       │   │   └── instanceManager.ts
│       │   ├── orchestrator/
│       │   │   ├── sessionOrchestrator.ts
│       │   │   └── eventHandler.ts
│       │   ├── proof/
│       │   │   ├── proofBuilder.ts
│       │   │   ├── proofRelayer.ts
│       │   │   └── timeoutWatcher.ts
│       │   ├── settlement/
│       │   │   └── settlementService.ts
│       │   ├── onchain/
│       │   │   ├── baseClient.ts
│       │   │   ├── contractClient.ts
│       │   │   └── eventWatcher.ts
│       │   ├── data/
│       │   │   ├── onchainosClient.ts
│       │   │   └── adapters.ts
│       │   ├── payments/
│       │   │   └── x402Server.ts
│       │   └── realtime/
│       │       └── sseHub.ts
│       ├── db/
│       │   ├── schema.sql
│       │   └── client.ts
│       └── types/
│           └── index.ts
│
├── agent/
│   ├── package.json
│   └── src/
│       ├── index.ts                    — Unified LLM runtime entry
│       ├── runtime/
│       │   ├── instanceRunner.ts       — Runs one agent instance
│       │   └── configLoader.ts         — Loads skill config
│       ├── prompts/
│       │   ├── poolSnapshot.ts
│       │   ├── yieldCompare.ts
│       │   └── tokenFlow.ts
│       ├── tools/
│       │   ├── readPoolState.ts
│       │   ├── readTokenFlow.ts
│       │   └── computeMetrics.ts
│       ├── proof/
│       │   ├── buildProofPackage.ts
│       │   └── hashProofPackage.ts
│       └── types/
│           └── index.ts
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── app/
│   │   ├── page.tsx                    — Landing
│   │   ├── curator/
│   │   │   ├── page.tsx                — Curator dashboard
│   │   │   └── agents/
│   │   │       ├── new/page.tsx        — Upload new agent
│   │   │       └── [id]/page.tsx       — Edit agent + stats
│   │   ├── marketplace/
│   │   │   └── page.tsx                — Browse agents
│   │   ├── session/
│   │   │   └── [id]/
│   │   │       └── page.tsx            — Live session
│   │   └── query/
│   │       └── page.tsx                — Spot query
│   ├── components/
│   │   ├── wallet/
│   │   ├── curator/
│   │   ├── marketplace/
│   │   ├── session/
│   │   └── query/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── baseClient.ts
│   │   ├── sse.ts
│   │   └── format.ts
│   └── types/
│       └── index.ts
│
└── shared/
    ├── abis/
    │   └── ManyMeEscrow.ts
    ├── config/
    │   ├── chains.ts
    │   ├── addresses.ts
    │   └── pricing.ts
    └── types/
        └── common.ts
```

---

## 11. 10-Day Build Plan

### Work Split

- **Dev A**: Contract + Backend + Base + x402
- **Dev B**: Frontend + Agent Runtime + Demo

```
┌───────────┬──────────────────────────────┬──────────────────────────────┐
│ Day       │ Dev A (Contract + Backend)   │ Dev B (Frontend + Agent)     │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 1     │ Foundry + ManyMeEscrow    │ Next.js + wallet connect     │
│           │ Agent registry functions     │ Marketplace page shell       │
│           │ Deploy to Base Sepolia    │ Curator page shell           │
│           │ viem client setup            │ Session page shell           │
│           │                              │                              │
│ MILESTONE │ registerAgent + createSession work on testnet. Pages render.│
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 2     │ Session + accrual + claim    │ AgentConfigForm (curator)    │
│           │ Settlement tracking logic    │ AgentCatalogGrid (marketplace)│
│           │ Agent Registry API (CRUD)    │ SessionControlPanel (user)   │
│           │ DB schema                    │ SalaryTicker + CostBreakdown │
│           │                              │                              │
│ MILESTONE │ Curator registers agent → user starts session → salary.     │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 3     │ submitProof + proofWindow    │ Instance runner skeleton     │
│           │ enforceProofTimeout          │ Mock agent output via SSE    │
│           │ Proof relayer service        │ ProofHeartbeatTimeline       │
│           │ Event watcher (WebSocket)    │ StreamStatusBadge            │
│           │                              │                              │
│ MILESTONE │ Proof every 3-5s. Timeout auto-pauses. Dashboard reacts.    │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 4     │ Instance Manager service     │ Config loader + real runtime │
│           │ Skill config → LLM session   │ AgentWorkTimeline (live)     │
│           │ SSE hub for step streaming   │ MetricsGrid component        │
│           │ Orchestrator event handlers  │ Curator earnings page        │
│           │                              │                              │
│ MILESTONE │ Curator's config drives agent behavior. Live work visible.  │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 5     │ OnchainOS API integration    │ Pool snapshot template       │
│           │ Market + Trade adapters      │ Real agent → real data       │
│           │ Proof package builder        │ FindingsCard component       │
│           │                              │                              │
│ MILESTONE │ Agent analyzes real Base data. Proofs contain evidence.  │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 6     │ Second template adapter      │ Yield compare template       │
│           │ Settlement service complete  │ Token flow template          │
│           │ Curator payout tracking      │ Curator stats + charts       │
│           │                              │                              │
│ MILESTONE │ 2-3 agent types. Curator earnings tracked.                  │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 7     │ x402 middleware              │ Spot query page              │
│           │ Paid endpoints               │ X402PaywallCard              │
│           │ Receipt logging              │ PaidResponseViewer           │
│           │                              │                              │
│ MILESTONE │ x402 pay-per-query end-to-end.                              │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 8     │ ──────────── INTEGRATION ────────────                       │
│           │ End-to-end: curator → user → session → proof → settle       │
│           │ Base mainnet deploy       │ All pages connected          │
│           │                              │                              │
│ MILESTONE │ Full three-party flow on mainnet. 50+ txs verified.         │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 9     │ Edge cases + hardening       │ Animations + visual polish   │
│           │ Demo mode config             │ Settlement breakdown UI      │
│           │ Seed demo agents + data      │ Explorer links               │
│           │                              │                              │
│ MILESTONE │ Demo stable. Visual polish complete.                        │
├───────────┼──────────────────────────────┼──────────────────────────────┤
│ Day 10    │ Env freeze + final deploy    │ Rehearse 3-min demo          │
│           │ Backup demo data             │ Record fallback video        │
│           │ Pitch deck                   │ Submission prep              │
│           │                              │                              │
│ MILESTONE │ Ship.                                                       │
└───────────┴──────────────────────────────┴──────────────────────────────┘
```

### Cut Priority (if behind)

1. ~~Third analysis template~~ — cut first
2. ~~Curator stats charts~~
3. ~~x402 evidence endpoint~~
4. ~~Mobile layout~~
5. x402 basic endpoint — cut last
6. Proof-pause demo moment — **NEVER cut**
7. Three-party settlement display — **NEVER cut**
8. Salary ticker — **NEVER cut**

---

## 12. Risk Mitigation

```
┌────────────────────────────────┬───────────────────────────────────────────┐
│ Risk                           │ Mitigation                                │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Base DeFi ecosystem thin    │ OnchainOS aggregates across OKX ecosystem.│
│                                │ Can analyze cross-chain data.             │
│                                │ Base = settlement chain.               │
├────────────────────────────────┼───────────────────────────────────────────┤
│ OnchainOS API immature         │ Fallback: direct RPC + public APIs.       │
│                                │ Agent adapters are swappable.             │
├────────────────────────────────┼───────────────────────────────────────────┤
│ x402 integration complex       │ Use x402-gateway-template (Docker).       │
│                                │ x402 is nice-to-have; streaming is core.  │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Three-party adds scope         │ Curator dashboard is minimal: one form +  │
│                                │ one earnings card. Marketplace is a grid. │
│                                │ Settlement is DB tracking, not real-time. │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Multi-instance complexity      │ For hackathon: max 2-3 concurrent.        │
│                                │ Instances share one process, not real VMs. │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Proof feels fake               │ Frame as liveness + evidence anchoring.   │
│                                │ Show real work alongside proof hashes.    │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Agent output quality           │ Code computes metrics. LLM only explains. │
│                                │ Pre-test demo prompts.                    │
├────────────────────────────────┼───────────────────────────────────────────┤
│ Gas costs                      │ Base near-zero. 60+ txs < $0.01.      │
└────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 13. Demo Choreography

### 3-Minute Demo Script

**Scene 1: Curator Onboarding (0:00–0:30)**
> Curator opens dashboard → uploads "DeFi Pool Analyst" config:
> - System prompt, tools, pricing ($0.001/sec)
> - Submit → agent appears in marketplace
> - "Anyone can be an AI agent creator. Upload a skill config, set your price."

**Scene 2: User Discovery (0:30–0:50)**
> User opens marketplace → browses agents → selects "DeFi Pool Analyst"
> - Sees rate breakdown: "$0.001/sec to curator + $0.0003/sec platform = $0.0013/sec"
> - Deposits 5 USDC → starts session

**Scene 3: Streaming Work (0:50–1:40)**
> Agent starts analyzing:
> - Live timeline: data fetches → metrics → findings
> - Salary counter ticking: $0.001… $0.005… $0.010…
> - Every 3 seconds: "✓ Proof Anchored on Base"
> - Cost breakdown updating in real-time

**Scene 4: Accountability (1:40–2:10)**
> Kill agent instance → proof stops
> - 10 seconds later: counter FREEZES → "⚠️ PAUSED: No Proof"
> - "You only pay for work that actually happens."
> - Restart instance → proof resumes → counter restarts

**Scene 5: x402 Spot Query (2:10–2:30)**
> Public user queries agent for $0.005 via x402
> - HTTP 402 → pay → analysis unlocks
> - "Two ways to monetize: streaming salary + spot queries"

**Scene 6: Settlement (2:30–2:50)**
> Session ends → settlement breakdown:
> - Total: $0.065
> - Curator earned: $0.050
> - Platform earned: $0.015
> - Curator earnings dashboard updates

**Scene 7: Vision (2:50–3:00)**
> "Three parties. One payment stream. 60+ on-chain transactions. Total gas: $0.008."
> "Curators build AI agents. Users pay per-second. The platform settles everything."
> "That's ManyMe."

### 60-Second Pitch

> "AI agents are getting smarter every day. But there's no marketplace where creators can monetize them per-second and users can pay only for actual work done."
>
> "ManyMe is a three-party AI agent marketplace on Base. Curators upload skill configs and set their price. Users browse, select, and pay per-second while watching the agent work live. Every 3 seconds, a proof-of-work is anchored on-chain. No proof? Payment stops instantly."
>
> "60+ on-chain transactions. Total gas under $0.01. Revenue splits automatically between curator and platform. This is only possible on Base's zero-gas infrastructure."

---

## Appendix A: Key External References

| Resource | URL |
|---|---|
| Base Docs | https://web3.okx.com/zh-hans/base/docs/developer/build-on-base/about-base |
| OnchainOS Dev Docs | https://web3.okx.com/onchainos/dev-docs/wallet/onchain-gateway-api-reference |
| OnchainOS Skills (GitHub) | https://github.com/okx/onchainos-skills |
| x402 Protocol | https://www.x402.org/ |
| x402 Gateway Template | https://github.com/azep-ninja/x402-gateway-template |
| Base RPC | https://mainnet.base.org |
| Base WebSocket |  |
| Base Flashblocks | https://mainnet.base.org/flashblocks |
| Base Explorer | https://basescan.org |

## Appendix B: Environment Variables

```env
# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_WS_URL=
BASE_CHAIN_ID=8453

# Contracts
ESCROW_CONTRACT_ADDRESS=
USDC_ADDRESS=

# Platform
PLATFORM_WALLET=
PLATFORM_OPERATOR_KEY=         # For submitting proofs
DEPLOYER_PRIVATE_KEY=

# OnchainOS
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_PASSPHRASE=

# AI (Google AI Studio)
GEMINI_API_KEY=
AI_MODEL_LIVE=gemini-2.0-flash
AI_MODEL_SYNTHESIS=gemini-2.5-pro-exp-03-25

# x402
X402_PAYMENT_ADDRESS=
X402_NETWORK=base

# Database
DATABASE_URL=file:./dev.db
```
