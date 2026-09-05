# ManyMe — 剩餘工作清單與操作教學

> 代碼已經全部寫完，以下是上線前需要你們手動完成的事項。

---

## 📋 待辦清單

### 🔴 必要（不做就無法 Demo）

- [ ] **1. 取得 Base 測試網 ETH**
- [ ] **2. 部署合約到 Base 測試網**
- [ ] **3. 更新合約地址到設定檔**
- [ ] **4. 設定 Gemini API Key（讓 Agent 產出真實分析）**
- [ ] **5. 完整跑一次 Demo 確認流程**
- [ ] **6. 錄製 Demo 影片**

### 🟡 建議（讓 Demo 更強）

- [ ] **7. 設定 OKX OnchainOS API Key（真實市場數據）**
- [ ] **8. 部署到 Base 主網**
- [ ] **9. 建立專案 X (Twitter) 帳號**
- [ ] **10. 準備 Hackathon 提交材料**

### 🟢 加分（時間夠再做）

- [ ] **11. 部署前端到 Vercel**
- [ ] **12. 部署後端到 Railway/Fly.io**
- [ ] **13. 錄製備份 Demo 影片（以防現場掛掉）**

---

## 📖 操作教學

### 1. 取得 Base 測試網 ETH

Base 測試網需要 ETH 作為 Gas Token。

**方法 A：OKX 交易所提幣**
1. 登入 [OKX](https://www.okx.com)
2. 錢包 → 提幣 → 選擇 ETH
3. 網路選擇 **Base Sepolia**（如果沒有此選項，用方法 B）
4. 輸入你的 deployer 錢包地址
5. 提取少量 ETH（0.1 ETH 就夠部署 + 跑 Demo）

**方法 B：Base 測試網水龍頭**
1. 前往 [Coinbase Base Sepolia Faucet](https://portal.cdp.coinbase.com/products/faucet) 或 [Circle USDC Faucet](https://faucet.circle.com)
2. 連接你的錢包
3. 領取測試網 ETH

**方法 C：直接用主網（跳過測試網）**
1. 如果測試網水龍頭不可用，直接跳到步驟 8 部署主網
2. 主網 ETH 可以從 OKX 交易所直接提幣到 Base 主網

**驗證：**
```bash
cast balance YOUR_WALLET_ADDRESS --rpc-url https://sepolia.base.org
# 應該看到 > 0
```

---

### 2. 部署合約到 Base 測試網

**前置：需要一個有 ETH 的錢包私鑰**

```bash
# 進入專案目錄
cd manyme

# 設定環境變數（用你自己的私鑰替換）
export DEPLOYER_PRIVATE_KEY="0x你的私鑰"
export PLATFORM_WALLET="你的平台錢包地址"
export PLATFORM_OPERATOR="你的平台錢包地址"  # Demo 用同一個即可
export PLATFORM_FEE_RATE=300
export USDC_ADDRESS="0x74b7F16337b8972027F6196A17a631aC6dE26d22"

# 部署
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# 記下輸出的合約地址，例如：
# ManyMeEscrow deployed at: 0xABC...123
```

**如果部署失敗：**
- `insufficient funds` → 回到步驟 1 取得更多 ETH
- `nonce too high` → 加上 `--nonce 0` 參數
- `gas estimation failed` → 加上 `--legacy` 參數

**驗證部署成功：**
```bash
cast call 0xABC...123 "platformWallet()" --rpc-url https://sepolia.base.org
# 應該回傳你的 PLATFORM_WALLET 地址
```

---

### 3. 更新合約地址到設定檔

部署成功後，把合約地址填入兩個地方：

**A. 後端 `.env` 檔**
```bash
# 在 backend/ 目錄下建立 .env
cd backend
cat > .env << 'EOF'
PORT=3001
ESCROW_CONTRACT_ADDRESS=0xABC...123
USDC_ADDRESS=0x74b7F16337b8972027F6196A17a631aC6dE26d22
PLATFORM_WALLET=你的平台錢包地址
PLATFORM_OPERATOR_KEY=0x你的私鑰
BASE_RPC_URL=https://sepolia.base.org
BASE_WS_URL=
EOF
```

**B. 共享設定檔 `shared/config/addresses.ts`**
```typescript
export const ADDRESSES = {
  testnet: {
    escrow: "0xABC...123",  // ← 填入你部署的地址
    usdc: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
  },
  mainnet: {
    escrow: "",  // 主網部署後填入
    usdc: "",
  },
};
```

---

### 4. 設定 Gemini API Key

Agent 需要 Google Gemini API 來產出真實的 DeFi 分析。沒有 Key 的話會用 mock 數據（也能 demo，但不夠有說服力）。

```bash
# 在 backend/.env 中加入
echo 'GEMINI_API_KEY=你的Gemini金鑰' >> backend/.env
```

**取得 API Key：**
1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 點「Create API Key」
3. 選一個 Google Cloud 專案（或建立新的）
4. 複製產生的 API Key

**預算估算：**
- Demo 跑 3 分鐘 ≈ 30 次 LLM 呼叫
- `gemini-2.0-flash` 免費額度：每分鐘 15 次請求
- **Google AI Studio 免費方案完全夠用**（不需要付費）

---

### 5. 完整跑一次 Demo

```bash
cd manyme

# Terminal 1: 啟動後端
cd backend
bun run src/db/init.ts   # 初始化資料庫
bun run src/server.ts     # 啟動 API server

# Terminal 2: 啟動前端
cd frontend
bun run dev               # 啟動 Next.js dev server

# 或者用一鍵 Demo 腳本
bash scripts/demo.sh
```

**測試流程：**

| 步驟 | 動作 | 預期結果 |
|---|---|---|
| 1 | 開啟 `http://localhost:3000` | 看到 Landing Page |
| 2 | 點「Browse Agents →」 | 看到 2 個 Agent 卡片 |
| 3 | 點「DeFi Pool Analyst」 | 看到詳細資訊 + 價格拆分 |
| 4 | 點「Start Session →」 | 跳轉到 Session 頁面 |
| 5 | 觀察 Salary Ticker | 數字每秒遞增 |
| 6 | 觀察 Proof Timeline | 每 3-5 秒出現新 proof |
| 7 | 觀察 Agent Work | 看到 API/RPC/Metric/Finding 步驟 |
| 8 | 開啟 `/query` | 看到 x402 付費查詢頁 |
| 9 | 選 Summary → Query | 看到 402 付費牆 |
| 10 | 點 Pay → | 看到分析結果解鎖 |
| 11 | 開啟 `/curator` | 看到 Curator Dashboard |
| 12 | 點「+ Upload Agent」 | 看到上傳表單 |

**如果 Session 頁面顯示 "No Active Session"：**
```bash
# 手動建立 Session（透過 API）
curl -X POST http://localhost:3001/api/sessions/1/spawn \
  -H "Content-Type: application/json" \
  -d '{"agentId":1,"userWallet":"0xDemo","totalRate":1300,"curatorRate":1000,"platformFee":300,"depositAmount":5000000}'

# 用回傳的 sessionId 開啟 Session 頁面
# http://localhost:3000/session/{sessionId}
```

---

### 6. 錄製 Demo 影片

**工具推薦：**
- macOS: QuickTime Player → 檔案 → 新增螢幕錄影
- 跨平台: [OBS Studio](https://obsproject.com/)（免費）
- 快速: [Loom](https://www.loom.com/)（有免費額度）

**Demo 腳本（3 分鐘）：**

詳細腳本請參考 `docs/DEMO.md`，簡要流程：

```
0:00-0:30  Curator 上傳 Agent → 出現在 Marketplace
0:30-1:00  User 瀏覽 Marketplace → 選擇 Agent → 開始 Session
1:00-1:45  觀看即時分析 + Salary 跳動 + Proof 落地
1:45-2:15  殺掉後端 → Counter 凍結 → "No proof = No pay"
2:15-2:35  x402 付費查詢 → 402 → 付款 → 解鎖
2:35-2:50  Settlement 拆分：Curator $X / Platform $Y
2:50-3:00  數據：60+ txs，gas < $0.01
```

**影片規格建議：**
- 解析度: 1920x1080
- 格式: MP4
- 長度: 3 分鐘以內
- 有旁白更好（英文）

---

### 7. 設定 OKX OnchainOS API Key（選做）

有了 OnchainOS Key，Agent 會用真實的市場數據分析，而不是 mock 數據。

**取得 API Key：**
1. 前往 [OKX Developer Portal](https://web3.okx.com/build)
2. 建立 API Key（需要 OKX 帳號）
3. 記下 `API Key`、`Secret Key`、`Passphrase`

```bash
# 加入 backend/.env
cat >> backend/.env << 'EOF'
OKX_API_KEY=你的API金鑰
OKX_SECRET_KEY=你的Secret金鑰
OKX_PASSPHRASE=你的密碼短語
EOF
```

**驗證：**
```bash
# 重啟後端後
curl http://localhost:3001/api/agents/1/market-data
# 應該看到真實的 ETH/USDC 價格，而不是 mock 數據
```

---

### 8. 部署到 Base 主網（選做）

跟測試網一樣的流程，換 RPC 即可：

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# 在 OKLink 上驗證合約
forge verify-contract $CONTRACT_ADDRESS \
  src/ManyMeEscrow.sol:ManyMeEscrow \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --etherscan-api-key $OKLINK_API_KEY
```

**注意：** 主網需要真正的 ETH（用 OKX 交易所提幣）。

---

### 9. 建立專案 X (Twitter) 帳號

Hackathon 提交需要專案的 X 帳號。

1. 建立 Twitter/X 帳號，名稱建議：`@ManyMeXYZ`
2. 頭貼：用 Teal (#00d4aa) 為主色調
3. Bio: "AI Agent Marketplace with Streaming Salary on Base. Pay per second. Proof stops, payment stops."
4. 發一則介紹推文，tag `@base` 和 `#OnchainOS`

---

### 10. 準備 Hackathon 提交材料

| 提交項目 | 內容 | 狀態 |
|---|---|---|
| GitHub Repo | https://github.com/bill3129066/manyme | ✅ 已完成 |
| Demo 影片 | 3 分鐘 MP4 | ⬜ 待錄製 |
| TX Hash | 部署合約的 tx hash | ⬜ 待部署 |
| 專案 X 帳號 | @ManyMeXYZ | ⬜ 待建立 |
| 專案描述 | 見下方模板 | ✅ 已寫好 |

**專案描述模板（英文）：**

> **ManyMe** is a three-party AI agent marketplace with streaming salary on Base.
>
> - **Curators** upload AI agent skill configs and set their pricing
> - **Users** browse the marketplace, select agents, and pay per-second in USDC
> - **The Platform** hosts a unified LLM runtime, submits on-chain proof-of-work every 3-5 seconds, and handles transparent revenue splitting
>
> Core innovation: Proof-gated streaming payments. If the agent stops producing verified work, payment stops instantly. No proof = no pay.
>
> Built with: Solidity (Foundry), Next.js, Hono, OnchainOS APIs, x402 protocol, Base (Chain ID 196).

---

### 11-13. 部署到雲端（加分）

**前端 → Vercel：**
```bash
cd frontend
npx vercel --prod
# 設定環境變數 NEXT_PUBLIC_API_URL 指向你的後端
```

**後端 → Railway：**
```bash
# 在 Railway.app 建立新專案
# 連接 GitHub repo
# 設定 Root Directory: backend
# 設定 Build Command: bun install
# 設定 Start Command: bun run src/server.ts
# 設定所有 .env 環境變數
```

---

## ⚠️ 常見問題

### Q: 後端啟動報錯 `Cannot find module`
```bash
cd backend && bun install
```

### Q: 前端 build 失敗
```bash
cd frontend && bun install && bun run build
```

### Q: 合約測試失敗
```bash
cd contracts && forge install && forge test
```

### Q: Session 頁面沒有數據
確認後端已啟動，且透過 API 建立了 session：
```bash
curl -X POST http://localhost:3001/api/sessions/1/spawn \
  -H "Content-Type: application/json" \
  -d '{"agentId":1,"userWallet":"0xTest","totalRate":1300,"curatorRate":1000,"platformFee":300,"depositAmount":5000000}'
```

### Q: x402 查詢回 404
確認路徑是 `/queries/agent/1/summary`（不是 `/api/queries/...`）。

### Q: TimeoutWatcher 太快暫停 Session
目前設為 30 秒。如果需要調整：
- 編輯 `backend/src/services/proof/timeoutWatcher.ts`
- 修改 `PROOF_WINDOW_MS` 的值

---

## 🏆 Hackathon 評分重點

根據我們的評審模擬分析，評審最看重：

1. **Technology Integration** — 展示 OnchainOS API + x402 的深度使用
2. **Presentation** — 3 分鐘 Demo 要有「wow moment」（salary counter 凍結那一刻）
3. **Business Value** — 三方 marketplace 模型有清晰的商業邏輯
4. **Originality** — 沒有人做過 proof-gated streaming salary for AI agents

**Demo 的 "wow moment" 是：殺掉 Agent → Counter 凍結 → "No proof = No pay"**

這一刻要練好，確保切換順暢、視覺效果明確。
