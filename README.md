# ManyMe 分身有術

**讓人們按需使用達人經驗的 AI 服務市集**

> 攻略我看過了,但我家不是範例家庭。

找到別人的建議很容易,知道怎麼把它用在自己身上卻困難得多。分身有術把達人和過來人的判斷方法——哪些條件該先確認、哪些選項不適合、以及為什麼——變成能針對你的情況提供引導的服務。達人上架經驗、使用者依使用付費、平台收取服務費。

完整敘事見 [docs/PITCH.md](docs/PITCH.md)。

## Quick Start

```bash
# Install dependencies
pnpm install

# Start backend
cd backend && bun run src/db/init.ts && bun run src/server.ts

# Start frontend (new terminal)
cd frontend && pnpm dev
```

Open http://localhost:3000

## 產品機制

- **達人・過來人**:把判斷原則、提問方式和案例整理成可上架的服務(表單或 SKILL.md 匯入),依使用分潤
- **使用者**:選擇信任的達人服務,設定本次預算,說明自己的情況;服務補問必要條件、比較選項、解釋取捨,補充新限制時建議跟著調整
- **平台**:代管服務運行、處理付費與分潤(服務費 3%)

## Features

### 服務市集(`/skills`、`/agents`)
- 瀏覽、搜尋、分類篩選;星等評分(1–5)
- 上架:手動表單(`{{variable}}` 自動偵測、輸入欄位建構器、模型/溫度/定價設定)或匯入標準化 SKILL.md 目錄
- 按次計價,USDC 微額計費

### 服務執行(`/skills/[id]`)
- JSON Schema 自動生成輸入表單
- 單次執行與 SSE 串流兩種模式
- LLM function calling 搭配 8 個 on-chain RPC 工具(進階資料型服務用)
- 執行歷史(All/Mine 過濾)、餘額顯示與儲值

### 進行中的服務(`/session/[id]`)
- 即時費用累計(本次預算框架)與成本拆解(作者分潤 + 平台服務費)
- 服務工作時間軸(SSE:步驟、進度證明、收益)
- 與服務對話,依你補充的條件調整建議

### 多用戶隔離與安全
- 全部寫入操作驗證錢包簽名(EIP-191),nonce 防重放
- 每錢包限流(執行路由 10 req/60s)
- 執行歷史權限分級;LLM 併發佇列(最多 3 併發)

### 付費基礎設施(幕後)
- **平台餘額**:鏈上 USDC 入金經 receipt 驗證後入帳(tx hash 防重放)
- **x402 按次付費**:官方 v2 協議(facilitator verify/settle),開發模式可用 mock
- **託管合約**(`ManyMeEscrow`,Base Sepolia):本次預算託管、按秒計費、進度證明把關、用戶退款與作者領款

## Architecture

```
contracts/   — Solidity (ManyMeEscrow — registry + escrow + proofs)
backend/     — Hono + Bun + SQLite
  api/         — REST routes (agents, sessions, skills, curator, queries)
  middleware/  — Signature verification, rate limiting
  services/    — Skill executor (tool-use loop), billing, deposit verifier,
                 x402, proof relayer, settlement + payout, SSE
skills/      — Skill packs (SKILL.md + patterns/*.md, auto-seeded on DB init)
agent/       — Unified LLM runtime (loads curator skill configs)
frontend/    — Next.js 14 + Tailwind + RainbowKit + wagmi
```

## Stack

- **AI**: Google Gemini with function calling
- **Payment**: USDC(Base Sepolia)— 平台餘額 + x402 按次付費 + escrow 預算託管
- **Auth**: EIP-191 wallet signatures(wagmi + viem)
- **On-Chain Data**: Direct RPC via viem(Ethereum、Arbitrum、Base、BSC、Polygon)

## Contract Tests

```bash
cd contracts && forge test
# 26/26 tests pass
```

## Docs

- [Pitch Script 分身有術](docs/PITCH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Skill Upload Architecture](docs/SKILL_UPLOAD_ARCHITECTURE.md)
- [Demo Script](docs/DEMO.md)
