# ManyMe — 3-Minute Demo Script

## Setup (before demo)
```bash
# Terminal 1: Backend
cd backend && bun run src/server.ts

# Terminal 2: Frontend  
cd frontend && bun run dev
```

Open: http://localhost:3000

---

## Scene 1: Curator Uploads Agent (0:00–0:30)

**Narration**: "Anyone can become an AI agent curator. Upload a skill config, set your price."

1. Navigate to http://localhost:3000/curator/agents/new
2. Fill in:
   - Name: "DeFi Pool Analyst"
   - Description: "Analyzes DEX pool health using OnchainOS Market API"
   - Rate: 1000 (= $0.001/sec)
3. Click "Upload Agent →"
4. **Show**: Agent appears in marketplace

**Key point**: Curator sets their own price. Platform adds $0.0003/sec fee.

---

## Scene 2: User Browses & Starts Session (0:30–1:00)

**Narration**: "Users browse the marketplace and pay per-second. No subscription."

1. Navigate to http://localhost:3000/marketplace
2. Show agent cards with rate breakdown:
   - Curator: $0.0010/sec
   - Platform: $0.0003/sec  
   - **Total: $0.0013/sec**
3. Click agent → Detail modal → "Start Session →"
4. Navigate to session page

**Key point**: Three-party split is transparent before you pay.

---

## Scene 3: Live Streaming Work (1:00–1:45)

**Narration**: "Watch the agent work in real-time. Every 3-5 seconds, a proof is anchored on-chain."

1. Session page loads — salary ticker starts: $0.0000 → $0.0013 → $0.0026...
2. Agent work timeline populates:
   - [API] OnchainOS Market API — Fetching pool-snapshot data
   - [RPC] X Layer RPC — Reading block #12900000
   - [METRIC] Pool Metrics — TVL: $2.4M | 24h Vol: $180K
   - [FINDING] Analysis — Pool shows healthy activity...
3. Proof heartbeat timeline: ✓ Proof #1 Anchored, ✓ Proof #2 Anchored...

**Key point**: Proof = liveness verification. Agent proves it's working every 3-5 seconds.

---

## Scene 4: The Accountability Moment (1:45–2:15)

**Narration**: "What happens if the agent stops working?"

1. Kill the backend: Ctrl+C in Terminal 1
2. Watch the session page:
   - Salary counter **FREEZES**
   - Status badge changes to **"PAUSED — NO PROOF"**
3. Say: "No proof = no pay. You only pay for work that actually happens."
4. Restart backend: `cd backend && bun run src/server.ts`
5. Counter **resumes** — agent picks up where it left off

**Key point**: This is the core value proposition. Accountability built into the protocol.

---

## Scene 5: x402 Spot Query (2:15–2:35)

**Narration**: "Two monetization modes: streaming salary AND spot queries via x402."

1. Navigate to http://localhost:3000/query
2. Select "Analysis Summary" ($0.001)
3. Click "Query for $0.001 →"
4. Show: HTTP 402 Payment Required response
5. Click "Pay $0.001 USDC →" (simulated payment)
6. Show: Analysis unlocks instantly

**Key point**: x402 = HTTP 402 Payment Required. Machine-to-machine payment protocol.

---

## Scene 6: Settlement (2:35–2:50)

**Narration**: "When the session ends, revenue splits automatically."

1. Show session settlement breakdown:
   - Total: $0.065
   - Curator earned: $0.050 (77%)
   - Platform fee: $0.015 (23%)
2. Navigate to http://localhost:3000/curator
3. Show curator earnings dashboard

**Key point**: Three-party settlement. Transparent. On-chain.

---

## Scene 7: Numbers (2:50–3:00)

**Narration**: "60+ on-chain transactions. Total gas: under $0.01. This only works on X Layer."

- Show: proof-packages directory (60+ proof files)
- Say: "On Ethereum mainnet, gas alone would cost more than the agent's entire salary."
- Say: "X Layer's near-zero gas makes per-second settlement economically viable."

---

## 60-Second Pitch

> "AI agents are getting smarter. But there's no marketplace where creators monetize them per-second and users pay only for real work.
>
> ManyMe is a three-party AI agent marketplace on X Layer. Curators upload skill configs and set their price. Users browse, select, and pay per-second while watching the agent work live. Every 3-5 seconds, a proof-of-work is anchored on-chain. No proof? Payment stops instantly.
>
> 60+ on-chain transactions. Total gas under $0.01. Revenue splits automatically between curator and platform. This is only possible on X Layer's zero-gas infrastructure."

---

## Backup Plan (if live demo fails)

1. Show the GitHub repo with all commits
2. Show the architecture diagram in docs/ARCHITECTURE.md
3. Describe the E2E test results (9 steps, proofs, x402 402→200)
4. Show the contract tests: 24/24 passing including 501 fuzz runs
