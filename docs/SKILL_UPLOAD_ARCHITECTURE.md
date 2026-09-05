# Skill Upload & Execution Architecture

## Overview

讓用戶能上傳自訂 Skills（prompt + 工具組合 + 定價），並在網頁上點擊個別執行。
每個 Skill 是獨立的可執行單元，不再綁定於固定的 agent 分析循環。

---

## 核心概念變更

### 現狀

```
Agent = 一包 skill config（systemPrompt + model + analysisTemplates）
Session = 啟動 agent → 8 秒循環自動跑分析 → 持續產出 findings
```

- Agent 是大粒度的：一個 agent 包含所有 skill，用 session 驅動
- 用戶無法選擇執行單一 skill
- 技能配置硬編碼在 `skill_config_json` 內

### 目標

```
Skill = 獨立的可執行單元（prompt + tools + input schema + pricing）
Agent = Skills 的容器 / 策展集合
Execution = 用戶點擊一個 skill → 單次或串流執行 → 回傳結果
```

---

## Data Model

### 新增 `skills` 表

```sql
CREATE TABLE skills (
  id            TEXT PRIMARY KEY,          -- UUID
  agent_id      INTEGER REFERENCES agents(id),  -- 所屬 agent（可選，null = 獨立 skill）
  creator_wallet TEXT NOT NULL,            -- 上傳者錢包
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT DEFAULT 'general',    -- DeFi, Trading, Research, General...

  -- 執行定義
  system_prompt TEXT NOT NULL,             -- LLM system prompt
  user_prompt_template TEXT,               -- 帶 {{variable}} 的 user prompt 模板
  model         TEXT DEFAULT 'gemini-2.0-flash',
  temperature   REAL DEFAULT 0.3,
  max_tokens    INTEGER DEFAULT 1024,
  tools_json    TEXT,                      -- JSON: 可使用的工具列表
  input_schema_json TEXT,                  -- JSON Schema: 用戶需要填的輸入欄位

  -- 定價
  price_per_run INTEGER DEFAULT 0,         -- 單次執行價格 (USDC micro-units)
  rate_per_second INTEGER,                 -- 串流模式的秒費率 (null = 僅單次)

  -- 執行模式
  execution_mode TEXT DEFAULT 'once',      -- 'once' | 'stream'
  --   once: 單次請求 → 回傳結果
  --   stream: 啟動持續串流 session

  -- 狀態
  active        INTEGER DEFAULT 1,
  run_count     INTEGER DEFAULT 0,         -- 被執行次數
  avg_rating    REAL,                      -- 用戶評分
  metadata_uri  TEXT,                      -- 外部連結 (GitHub etc.)
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_creator ON skills(creator_wallet);
CREATE INDEX idx_skills_agent ON skills(agent_id);
```

### 新增 `skill_executions` 表

```sql
CREATE TABLE skill_executions (
  id            TEXT PRIMARY KEY,          -- UUID
  skill_id      TEXT REFERENCES skills(id),
  user_wallet   TEXT NOT NULL,
  session_id    TEXT REFERENCES sessions(id),  -- 若為 stream 模式則關聯 session

  -- 輸入/輸出
  input_json    TEXT,                      -- 用戶提供的輸入參數
  output_text   TEXT,                      -- LLM 回傳結果
  output_metadata_json TEXT,               -- 結構化輸出（tool calls 結果等）

  -- 狀態
  status        TEXT DEFAULT 'pending',    -- 'pending' | 'running' | 'completed' | 'failed'
  error_message TEXT,
  duration_ms   INTEGER,                   -- 執行耗時
  tokens_used   INTEGER,                   -- token 消耗

  -- 計費
  amount_charged INTEGER DEFAULT 0,        -- 實際收費 (USDC micro-units)
  created_at    TEXT DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE INDEX idx_executions_skill ON skill_executions(skill_id);
CREATE INDEX idx_executions_user ON skill_executions(user_wallet);
```

### 修改 `agents` 表

不改現有欄位。新增：

```sql
ALTER TABLE agents ADD COLUMN skill_ids TEXT;  -- JSON array of skill IDs
-- 一個 agent 可以組合多個 skills
```

---

## API Endpoints

### Skill CRUD

```
POST   /api/skills              -- 上傳新 skill
GET    /api/skills              -- 列出所有 skills（支援 ?category=&creator=&q= 篩選）
GET    /api/skills/:id          -- 取得 skill 詳情
PUT    /api/skills/:id          -- 更新 skill（需 creator_wallet 授權）
DELETE /api/skills/:id          -- 停用 skill
```

### Skill Execution

```
POST   /api/skills/:id/run      -- 單次執行 skill
  Body: { userWallet, inputs: { ...根據 input_schema } }
  Response: { executionId, output, durationMs, tokensUsed }

POST   /api/skills/:id/stream   -- 串流執行 skill（啟動 session）
  Body: { userWallet, inputs: { ... } }
  Response: { executionId, sessionId }

GET    /api/skills/:id/stream/:execId  -- SSE 串流結果
  Events: chunk | tool_call | complete | error
```

### Skill Stats

```
GET    /api/skills/:id/stats    -- 執行次數、平均評分、收益
POST   /api/skills/:id/rate     -- 用戶評分 { rating: 1-5 }
GET    /api/skills/popular       -- 熱門 skills 排行
```

---

## Backend Architecture

### 新增 Service: `SkillExecutor`

```
backend/src/services/skill/
├── skillExecutor.ts       -- 核心執行引擎
├── skillRegistry.ts       -- Skill CRUD 操作
├── inputValidator.ts      -- 驗證用戶輸入是否符合 input_schema
└── templateRenderer.ts    -- 將用戶輸入渲染到 prompt 模板
```

#### SkillExecutor 流程（once 模式）

```
1. 驗證 input_schema → 拒絕不合法輸入
2. 渲染 user_prompt_template（填入用戶變數）
3. 組裝 tool configs（若有 tools_json）
4. 呼叫 Gemini API
   - system: skill.system_prompt
   - user: 渲染後的 prompt + 用戶輸入
   - tools: 解析 tools_json → function declarations
5. 若有 tool calls → 執行 tool → 回傳結果給 LLM（loop）
6. 記錄 skill_executions（output, duration, tokens）
7. 回傳結果
```

#### SkillExecutor 流程（stream 模式）

```
1-3. 同上
4. 建立 session + skill_execution 記錄
5. 啟動 SSE 連線
6. Gemini streaming API → 逐 chunk 推送
7. Tool calls 中間結果也推送
8. 完成後更新 execution 記錄
```

### 修改現有 Service

#### InstanceManager

新增 `runSkillOnce()` 方法，不需要 session 循環：

```typescript
async runSkillOnce(skillId: string, inputs: Record<string, unknown>): Promise<ExecutionResult> {
  // 載入 skill config
  // 驗證 inputs
  // 單次 Gemini 呼叫
  // 回傳結果
}
```

---

## Frontend Architecture

### 新增頁面

```
frontend/app/
├── skills/
│   ├── page.tsx              -- Skill 市場（瀏覽 + 搜尋 + 分類篩選）
│   └── [id]/
│       ├── page.tsx          -- Skill 詳情 + 執行介面
│       └── history/
│           └── page.tsx      -- 此 skill 的執行歷史
├── upload/
│   └── page.tsx              -- 上傳 Skill 表單
```

### 新增 Components

```
frontend/components/
├── skill/
│   ├── SkillCard.tsx          -- 市場中的 skill 卡片
│   ├── SkillDetailPanel.tsx   -- Skill 詳情面板
│   ├── SkillInputForm.tsx     -- 動態表單（根據 input_schema 生成）
│   ├── SkillOutputView.tsx    -- 執行結果顯示（markdown 渲染）
│   ├── SkillRunButton.tsx     -- 執行按鈕（含 loading 狀態）
│   └── SkillRating.tsx        -- 評分組件
├── upload/
│   ├── SkillUploadForm.tsx    -- 上傳表單主體
│   ├── PromptEditor.tsx       -- System prompt 編輯器
│   ├── InputSchemaBuilder.tsx -- 視覺化建構 input schema
│   └── ToolSelector.tsx       -- 勾選可用工具
```

### Skill 詳情 + 執行頁 (`/skills/[id]`)

頁面分為左右兩欄（或上下）：

```
┌─────────────────────────────────────────────────┐
│  Skill: "DeFi Pool Analyzer"                    │
│  By: 0xabc...def  |  ⭐ 4.3  |  🔄 1,234 runs  │
│  Category: DeFi   |  Price: $0.003/run          │
├────────────────────┬────────────────────────────┤
│                    │                            │
│  📝 Input Form     │   📊 Output               │
│  (auto-generated   │   (markdown rendered)      │
│   from schema)     │                            │
│                    │   Loading... / Results     │
│  [Pool Address]    │                            │
│  [Chain: ▼]        │   ┌─────────────────────┐  │
│  [Time Range: ▼]   │   │ "The ETH/USDC pool  │  │
│                    │   │  shows 2.4M TVL..." │  │
│  [▶ Run Skill]     │   └─────────────────────┘  │
│                    │                            │
│                    │   Tool Calls:              │
│                    │   ✅ fetch_pool_data       │
│                    │   ✅ compute_metrics       │
│                    │                            │
│                    │   Tokens: 342 | 1.2s       │
│                    │   ⭐ Rate this result      │
├────────────────────┴────────────────────────────┤
│  📜 Recent Executions                           │
│  • 2 min ago — "TVL healthy at $2.1M..."       │
│  • 15 min ago — "Volume spike detected..."     │
└─────────────────────────────────────────────────┘
```

### Skill 上傳頁 (`/upload`)

```
┌──────────────────────────────────────────┐
│  Upload New Skill                        │
├──────────────────────────────────────────┤
│  Name:        [___________________]      │
│  Description: [___________________]      │
│  Category:    [DeFi        ▼]            │
│                                          │
│  System Prompt:                          │
│  ┌──────────────────────────────────┐    │
│  │ You are a DeFi analyst...        │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  User Prompt Template:                   │
│  ┌──────────────────────────────────┐    │
│  │ Analyze the pool at {{address}}  │    │
│  │ on {{chain}} for the last        │    │
│  │ {{timeRange}}                    │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Input Fields: (auto-detected from       │
│  template, or manually add)              │
│  ┌──────────────────────────────────┐    │
│  │ + address  [text]    [required]  │    │
│  │ + chain    [select]  [required]  │    │
│  │ + timeRange [select] [optional]  │    │
│  │ [+ Add Field]                    │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Tools:                                  │
│  ☑ onchainos-market                      │
│  ☐ onchainos-trade                       │
│  ☑ rpc-read                              │
│  ☐ onchainos-wallet                      │
│                                          │
│  Model:    [gemini-2.0-flash ▼]          │
│  Temp:     [0.3        ]                 │
│  Max Tok:  [1024       ]                 │
│                                          │
│  Pricing:                                │
│  Mode:     [◉ Per-run  ○ Streaming]      │
│  Price:    [3000] micro-USDC / run       │
│                                          │
│  [Preview & Test]  [Publish Skill]       │
└──────────────────────────────────────────┘
```

---

## 執行流程

### 單次執行 (once mode)

```
User                    Frontend              Backend                  Gemini
 │                        │                     │                       │
 │ fill inputs & click    │                     │                       │
 │ [Run Skill]            │                     │                       │
 │───────────────────────>│                     │                       │
 │                        │ POST /skills/:id/run│                       │
 │                        │────────────────────>│                       │
 │                        │                     │ validate inputs       │
 │                        │                     │ render prompt template│
 │                        │                     │ create execution rec  │
 │                        │                     │                       │
 │                        │                     │ generateContent()     │
 │                        │                     │──────────────────────>│
 │                        │                     │                       │
 │                        │                     │     (tool_call?)      │
 │                        │                     │<──────────────────────│
 │                        │                     │ execute tool          │
 │                        │                     │──────────────────────>│
 │                        │                     │                       │
 │                        │                     │     final response    │
 │                        │                     │<──────────────────────│
 │                        │                     │                       │
 │                        │                     │ update execution rec  │
 │                        │  { output, stats }  │                       │
 │                        │<────────────────────│                       │
 │     show result        │                     │                       │
 │<───────────────────────│                     │                       │
```

### 串流執行 (stream mode)

```
User                    Frontend              Backend                  Gemini
 │                        │                     │                       │
 │ click [Run Skill]      │                     │                       │
 │───────────────────────>│                     │                       │
 │                        │ POST /skills/:id/stream                     │
 │                        │────────────────────>│                       │
 │                        │  { executionId }    │                       │
 │                        │<────────────────────│                       │
 │                        │                     │                       │
 │                        │ GET /skills/:id/stream/:execId (SSE)       │
 │                        │════════════════════>│                       │
 │                        │                     │ streamGenerateContent │
 │                        │                     │──────────────────────>│
 │                        │  event: chunk       │                       │
 │                        │<════════════════════│     stream chunks     │
 │  render chunks live    │  event: chunk       │<══════════════════════│
 │<═══════════════════════│<════════════════════│                       │
 │                        │  event: tool_call   │                       │
 │                        │<════════════════════│                       │
 │                        │  event: complete    │                       │
 │                        │<════════════════════│                       │
```

---

## Navigation 更新

```
NavBar: Home | Skills | Marketplace | Sessions | Curator
                 │
                 └── 新增入口，取代或與 Marketplace 並列
```

- `/skills` — Skill 市場（核心入口）
- `/upload` — 上傳 Skill
- `/marketplace` — 保留，展示 Agent（skill 組合包）
- `/curator` — 新增 My Skills 分頁

---

## 多使用者隔離設計

### 1. Wallet 簽名驗證（EIP-191 personal_sign）

所有寫入操作（create / update / delete / run）必須攜帶錢包簽名。
後端驗證簽名後，從簽名中恢復 wallet address，而非信任前端 POST body。

**簽名訊息格式：**
```
ManyMe Skill Action
Wallet: 0x...
Action: run-skill
Timestamp: 1711324800
Skill: <skillId>
```

**驗證流程：**
```
Frontend (wagmi)              Backend (viem)
  │                              │
  │ useSignMessage()             │
  │ signMessageAsync({message})  │
  │──────────────────────────────│
  │                              │
  │ Headers:                     │
  │   X-Wallet-Address           │
  │   X-Signature                │
  │   X-Timestamp                │
  │─────────────────────────────>│
  │                              │ verifyMessage()
  │                              │ check timestamp < 5min
  │                              │ set verifiedWallet
  │                              │──> route handler
```

**檔案：**
- `backend/src/middleware/verifySignature.ts` — Hono middleware
- `frontend/lib/sign-action.ts` — 簽名工具函式

**受保護的路由：**
| Route | Action | 說明 |
|---|---|---|
| `POST /api/skills` | `create-skill` | 建立 skill |
| `PUT /api/skills/:id` | `update-skill` | 更新 skill |
| `DELETE /api/skills/:id` | `delete-skill` | 刪除 skill（比對 creator_wallet）|
| `POST /api/skills/:id/run` | `run-skill` | 執行 skill |

### 2. Per-Wallet Rate Limiting

防止單一用戶耗盡共用 Gemini API quota。使用 Token Bucket 演算法。

- 預設限制：**10 次 / 60 秒**（per wallet）
- 僅套用在 `POST /api/skills/:id/run`（Gemini 呼叫路由）
- 超限回傳 `429 Too Many Requests` + `Retry-After` header
- 記憶體內 Map，每 60 秒清理過期 bucket

**檔案：** `backend/src/middleware/rateLimit.ts`

### 3. 執行歷史權限控制

`GET /api/skills/:id/executions` 根據請求者身份回傳不同資料：

| 請求者 | 回傳內容 |
|---|---|
| **Skill Creator**（`?wallet=` 比對 `creator_wallet`）| 所有 executions 完整資料 |
| **已認證用戶**（`?wallet=0x...`）| 僅自己的 executions 完整資料 |
| **未認證** | 所有 executions 的 metadata（`input_json`、`output_text` 為 null）|

### 4. Gemini 並發佇列

所有 Gemini API 呼叫經過 Semaphore 控制並發數量：

- 預設最大並發：**3**（`GEMINI_MAX_CONCURRENT` env var）
- 超出並發的請求排隊等待，30 秒 timeout 後回傳 503
- 防止突發流量導致 API key rate limit 或 timeout

**檔案：** `backend/src/services/skill/requestQueue.ts`

### 隔離矩陣

```
                    ┌─────────────┬─────────────┬─────────────┐
                    │   User A    │   User B    │  Anonymous  │
┌───────────────────┼─────────────┼─────────────┼─────────────┤
│ Create Skill      │  ✅ signed  │  ✅ signed  │  ❌ 401     │
│ Delete Own Skill  │  ✅ signed  │  ❌ 404     │  ❌ 401     │
│ Run Any Skill     │  ✅ signed  │  ✅ signed  │  ❌ 401     │
│ See Own Execs     │  ✅ full    │  ✅ full    │  ❌ no data │
│ See Others' Execs │  ❌ hidden  │  ❌ hidden  │  ❌ hidden  │
│ See All (Creator) │  ✅ if owns │  ✅ if owns │  ❌         │
│ Rate Limit        │  10/min     │  10/min     │  N/A        │
│ Gemini Queue      │  shared 3   │  shared 3   │  N/A        │
└───────────────────┴─────────────┴─────────────┴─────────────┘
```

---

## 實作優先順序

### Phase 1: 核心 MVP

1. **DB**: 建立 `skills` + `skill_executions` 表
2. **Backend**: Skill CRUD API (`/api/skills`)
3. **Backend**: `SkillExecutor.runOnce()` — 單次執行引擎
4. **Frontend**: `/upload` — Skill 上傳表單
5. **Frontend**: `/skills` — Skill 市場列表
6. **Frontend**: `/skills/[id]` — Skill 詳情 + 執行介面

### Phase 2: 增強

7. **Frontend**: 動態表單產生器（根據 input_schema_json）
8. **Backend**: Streaming 執行 + SSE
9. **Frontend**: 串流結果即時渲染
10. **Backend**: 執行計費 + 扣款

### Phase 3: 社群

11. Skill 評分 + 排行
12. Skill fork / remix
13. Agent 組合多個 Skills
14. 執行歷史 + 分析儀表板

---

## 與現有系統的關係

| 現有模組 | 變更 | 說明 |
|---|---|---|
| `agents` 表 | 新增 `skill_ids` 欄位 | Agent 可組合多個 Skills |
| `agents.routes.ts` | 不動 | 保持向後相容 |
| `InstanceManager` | 新增 `runSkillOnce()` | 複用 Gemini 初始化邏輯 |
| `RealAgentRunner` | 不動 | 串流 session 仍用現有邏輯 |
| `sseHub` | 擴充 | 支援 skill execution 的 SSE |
| `ProofRelayer` | Phase 2 | stream 模式的 skill 才需要 proof |
| `NavBar` | 新增 Skills 連結 | 主導航入口 |
| `Marketplace` | 保留 | Agent 維度的瀏覽 |

---

## Skill Prompt 壓縮流程

### 問題

原始 SKILL.md 通常 10-30KB，遠超 system prompt 的有效範圍（~2000 tokens）。
直接截斷會丟失關鍵規則；全部塞進去會浪費 token 預算。

### 自動壓縮 Pipeline

```
用戶上傳 SKILL.md (26KB)
    │
    ├── autoCompress = true?
    │   ├── POST /api/skills/compress
    │   │   └── Gemini 壓縮引擎:
    │   │       • MUST rules → 保留原文
    │   │       • SHOULD rules → 壓成一行
    │   │       • MAY rules → 刪除
    │   │       • Examples → 刪除
    │   │       • 長文 → 轉表格/決策樹
    │   │       • 重複 → 去重
    │   │   → 輸出 ~4KB 壓縮版
    │   │
    │   ├── 每個 pattern 也壓縮:
    │   │   POST /api/skills/compress?type=pattern
    │   │   → 保留步驟/公式/判斷標準
    │   │   → 刪除背景理論/長範例
    │   │   → 輸出 ~2KB 壓縮版
    │   │
    │   └── 前端顯示壓縮率 (e.g. "compressed 73%")
    │
    └── autoCompress = false?
        └── 直接截斷到 8000 chars
```

### 壓縮規則

| 原始內容 | 壓縮策略 | 範例 |
|---|---|---|
| MUST 規則 | 保留原文 | "Always anchor to same block" |
| SHOULD 規則 | 壓成一行 | "Decode hex before presenting" |
| MAY 規則 | 刪除 | "Consider using multicall" |
| 長段落 | 轉表格 | 3 段 → 3 行表格 |
| 條件邏輯 | 轉決策樹 | if/else → `─┬─ yes → ... └─ no → ...` |
| 函式選擇器 | 速查格式 | `name=06fdde03 sym=95d89b41` |
| 範例程式碼 | 刪除，只保留簽名 | 完整函式 → 一行 signature |
| 重複出現 | 去重，保留最精確版 | 兩處相同規則 → 一處 |

### Runtime Prompt 架構（tool-use 模式）

```
┌─────────────────────────────────────┐
│ systemInstruction (~1500 tokens)    │
│ • Core principle                    │
│ • Available tools list              │
│ • Workflow (5 phases, 1 line each)  │
│ • Critical rules (MUST only)        │
│ • Common selectors table            │
│ • Event signatures table            │
│ • Output format                     │
└─────────────────────────────────────┘
         +
┌─────────────────────────────────────┐
│ User prompt                         │
│ • User query (rendered template)    │
│ • Parameters (chain, address, etc.) │
│ • Reference context (~3000 chars)   │
│   └── keyword-matched pattern       │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Gemini multi-turn tool-use loop     │
│ 1. Gemini reads prompt              │
│ 2. Calls RPC tool (e.g. eth_call)  │
│ 3. Backend executes via viem        │
│ 4. Result sent back to Gemini       │
│ 5. Gemini calls more tools or       │
│    generates final text response    │
│ (max 50 tool calls per execution)   │
└─────────────────────────────────────┘
```

### API

```
POST /api/skills/compress
Body: { content: string, type: "skill" | "pattern" }
Response: {
  original: 26040,
  compressed: 4012,
  ratio: "84.6%",
  content: "compressed prompt text..."
}
```

### 前端 UI

上傳頁面有 "Auto-compress prompts" 勾選框（預設開啟）：
- 開啟：上傳前自動壓縮 SKILL.md + 每個 pattern，顯示壓縮率
- 關閉：直接截斷到 8000 chars（快但品質低）
