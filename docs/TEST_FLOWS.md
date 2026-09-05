# ManyMe — Frontend Test Flows (User Journey)

> **目的**：每條流程是 QA 在瀏覽器裡可一步步操作的端到端旅程。  
> 遇到分岔條件（錢包未連接、未授權、餘額不足…）會列出所有分支路徑。  
> **按角色分為兩大區**：一般使用者 (User)、策展人 (Curator)。  
> Trivial 檢查項統一放在文件最後。

---

## 環境前置

| 項目 | 值 |
|------|----|
| 網路 | X Layer Testnet (Chain ID 1952) |
| 錢包 | 任何支援 WalletConnect 的錢包，需切到 X Layer Testnet |
| USDC 合約 | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` |
| Escrow 合約 | `0x93e2794E042b6326356768B7CfDeFc871008239e` |
| 平台費 | 300 micro-USDC/sec (固定) |

---

# Part A — 一般使用者 (User)

## Journey U1：首次使用者完整購買旅程 — 連錢包 → 授權 → 儲值 → 執行付費 Skill

> 這是最完整的 happy path。從零開始到成功執行一個付費 skill。

### U1-1｜連接錢包

1. 開啟首頁 `/`，觀察 NavBar 右側顯示 `Connect Wallet` 按鈕
2. 點擊 `Connect Wallet`
3. RainbowKit modal 出現，選擇錢包（MetaMask / WalletConnect…）
4. 在錢包中確認連接

**預期**：NavBar 右側顯示已連接的地址（縮寫），全站解鎖錢包相關功能

**▸ 分岔 U1-1a：使用者拒絕連接**
- 在 RainbowKit modal 中點取消 / 在錢包中拒絕
- **預期**：回到未連接狀態，NavBar 仍顯示 `Connect Wallet`，所有需要錢包的操作維持 disabled

**▸ 分岔 U1-1b：錢包網路不是 X Layer Testnet**
- 連接成功但網路不對
- **預期**：RainbowKit 會提示切換網路；若未切換，後續鏈上操作（Approve）會失敗

---

### U1-2｜授權 Escrow 使用 USDC

1. 導航到 `/settings`
2. 觀察 `3-Step Funding Flow Guide`：Step 1 尚未打勾
3. 觀察 `Balance Overview`：Wallet USDC 顯示鏈上餘額、Platform Balance 為 0、Approved Limit 為 $0.00
4. 在 `Step 1: Authorize Escrow` 區塊，點選 `$100` preset（或 `Unlimited`）
5. 點擊 `Authorize`
6. 錢包跳出交易確認（呼叫 USDC.approve(escrow, amount)）
7. 確認交易

**預期**：
- 按鈕顯示 `Approving...` → 交易確認後顯示 `Approved ✓`
- Approved Limit 更新為設定的金額
- Step 1 打勾；出現提示「Approved. Complete step 2 (Deposit) to fund your platform balance.」
- Step 2 Deposit 區塊解鎖

**▸ 分岔 U1-2a：使用者拒絕交易**
- 在錢包中拒絕簽名
- **預期**：按鈕恢復為 `Authorize`，Approved Limit 不變

**▸ 分岔 U1-2b：Wallet USDC 餘額為 0**
- 鏈上沒有 USDC
- **預期**：Authorize 交易可以成功（approve 不需餘額），但後續 Deposit 會因無 USDC 而失敗

**▸ 分岔 U1-2c：使用者跳過此步驟直接嘗試 Deposit**
- 直接在 Step 2 區塊操作
- **預期**：Step 2 區塊顯示灰化 + 文字「Complete step 1 (Authorize) first」，無法操作

---

### U1-3｜存入平台餘額

1. 在 `Step 2: Deposit` 區塊，點選 `$10` preset
2. 點擊 `Deposit`
3. 錢包跳出簽名請求（EIP-191 personal_sign，action = `deposit`）
4. 確認簽名

**預期**：
- 按鈕顯示 `Depositing...` → `Deposited ✓`
- `Platform Balance` 更新（+10 USDC）
- Step 2 打勾；出現提示「All set. You can start running Skills.」
- `Balance Overview` 的 Total deposited 更新

**▸ 分岔 U1-3a：使用者拒絕簽名**
- **預期**：餘額不變，按鈕恢復

**▸ 分岔 U1-3b：存入金額為 0 或負數**
- 手動輸入 0 或 -1
- **預期**：後端回 400 錯誤，前端跳 alert

> **注意**：目前 Deposit 是 demo 模式（只寫 DB，不實際動鏈上 USDC）。Settings 頁的 Approve 是真的鏈上交易，但 Deposit 只是簽名後寫平台 DB。

---

### U1-4｜瀏覽並選擇 Skill

1. 導航到 `/skills`
2. 觀察預載的 skill 列表（17 個 pre-loaded skills）
3. 用 Category 篩選（例如點 `DeFi`）→ 列表篩選
4. 用搜尋欄輸入關鍵字 → 列表即時更新
5. 點擊一個付費 skill 卡片 → 導航到 `/skills/[id]`

**預期**：進入 skill 詳情頁，看到：
- Header：name / category / execution mode / run count / rating / price
- 左欄：Input form（動態欄位或 Query textarea）
- 右欄：Output 區（顯示「Run the skill to see output here」）
- 下方：Platform balance 顯示餘額，綠色表示足夠

**▸ 分岔 U1-4a：搜尋無結果**
- **預期**：顯示「No skills found」+ 連結到 `/upload`

**▸ 分岔 U1-4b：未連接錢包進入 skill 詳情頁**
- **預期**：Run 按鈕 disabled，顯示「Connect Wallet First」；無 balance 顯示；無評分區

---

### U1-5｜執行付費 Skill（Once 模式）

1. 在左側 Input form 填入必填欄位
2. 確認下方顯示 `Platform balance: $X.XXXX`（餘額充足）
3. 點擊 `Run Skill ($X.XXXX)`
4. 錢包跳出簽名請求（action = `run-skill`）
5. 確認簽名
6. 等待執行完成

**預期**：
- 按鈕變為 `Running...` + spinner
- 完成後右側 Output 顯示結果文字
- 底部顯示 `XXXms` / `XXX tokens`
- Platform balance 扣除 skill 價格
- Recent Executions 新增一筆 `completed`

**▸ 分岔 U1-5a：執行付費 Skill（Stream 模式）**
- 操作同上，但 output 會即時逐字追加
- 若 skill 有 RPC tools，會看到 `RPC Calls (N)` 區塊即時更新 tool activity
- **預期**：Output 區串流渲染 → 最後顯示 complete stats

**▸ 分岔 U1-5b：執行免費 Skill**
- 操作同上，但 Run 按鈕顯示 `Run Skill`（無價格）
- **預期**：不扣除餘額，其餘行為一致

**▸ 分岔 U1-5c：餘額不足**
- 進入一個 price > 0 的 skill，但 balance < price
- **預期**：
  - Input 區下方出現紅色 `Insufficient balance` 警告
  - 顯示「Need $X.XXXX · Have $Y.YYYY」
  - 提供兩個按鈕：「Go to Settings to deposit」（跳轉 /settings）和「+ Demo deposit 5 USDC」（當場儲值）
  - Run 按鈕**不會被 disabled**（前端未做此檢查），但按下去後 → 簽名 → 後端回 400 `Insufficient balance. Need X micro-USDC, have Y.` → 前端顯示紅色錯誤

**▸ 分岔 U1-5d：餘額不足 → 使用 Demo Deposit 補足**
- 在 U1-5c 的情況下，點擊 `+ Demo deposit 5 USDC`
- 簽名確認 → 餘額更新 → 重新點 `Run Skill` → 成功執行
- **預期**：完整走完執行流程

**▸ 分岔 U1-5e：使用者拒絕簽名**
- 在簽名請求中拒絕
- **預期**：前端 catch 簽名錯誤，顯示紅色錯誤訊息，Run 按鈕恢復

**▸ 分岔 U1-5f：必填欄位未填**
- 有 input schema 時留空必填欄位，直接點 Run
- **預期**：簽名 → 後端回 400 `Missing required field: XXX` → 前端顯示紅色錯誤

**▸ 分岔 U1-5g：Gemini 執行失敗**
- 後端 API key 無效或 Gemini 拋錯
- **預期**：once 模式會回 200 但 payload status = `failed`，前端顯示紅色錯誤；stream 模式會送 SSE `error` 事件

**▸ 分岔 U1-5h：Rate limit 觸發**
- 同一錢包在 60 秒內發送超過 10 次 run/stream 請求
- **預期**：後端回 429，前端顯示 rate limit 錯誤

---

### U1-6｜執行後評分

1. 成功執行後，在 Output 下方出現評分區
2. Hover 星星確認 hover 效果
3. 點擊第 4 顆星
4. 簽名確認（action = `rate-skill`）

**預期**：顯示 `Your rating: 4/5` + 平均分更新

**▸ 分岔 U1-6a：重新評分覆蓋**
- 再次點擊第 2 顆星 → 簽名
- **預期**：Your rating 更新為 2/5，平均分重算

**▸ 分岔 U1-6b：重新整理後評分區消失**
- 刷新頁面
- **預期**：Output 清空 → 評分區消失（只有本次頁面有 output 才顯示）

---

## Journey U2：未授權/未儲值就直接使用 Skill

> 使用者連了錢包但完全跳過 Settings 的 Approve + Deposit，直接去跑 skill。

### U2-1｜連錢包 → 直接前往 Skill 詳情頁

1. 連接錢包（同 U1-1）
2. 直接導航到 `/skills` → 點擊一個**付費** skill
3. 觀察 Skill 詳情頁

**預期**：
- 頁面正常載入
- Platform balance 顯示 `$0.0000`
- **紅色 `Insufficient balance` 警告出現**
- 顯示「Need $X.XXXX · Have $0.0000」
- 顯示「Go to Settings to deposit」和「+ Demo deposit 5 USDC」

### U2-2｜強行執行付費 Skill

1. 不管警告，填入 Input
2. 點擊 `Run Skill ($X.XXXX)`
3. 簽名確認

**預期**：
- 後端回 400 錯誤：`Insufficient balance. Need X micro-USDC, have 0.`
- 前端顯示紅色錯誤
- 不會產生 execution record

### U2-3｜改用 Demo Deposit 救場

1. 點擊 `+ Demo deposit 5 USDC`
2. 簽名確認 → 餘額更新為 $5.0000
3. 重新點擊 `Run Skill`
4. 簽名確認

**預期**：成功執行；output 正常顯示

### U2-4｜免費 Skill 不受影響

1. 改進入一個 `price_per_run = 0` 的 skill
2. 填 Input → 點 Run → 簽名

**預期**：不顯示 `Insufficient balance`，直接成功執行，不扣餘額

---

## Journey U3：瀏覽 Marketplace → 開始 Agent Session → 即時互動

> 使用者從 marketplace 挑 agent，開始 session，觀看即時工作，與 agent 對話。

### U3-1｜瀏覽 Marketplace 並選擇 Agent

1. 導航到 `/marketplace`
2. 等待 agent 列表載入（先看到 loading skeleton）
3. 用 Category 篩選
4. 點擊一個 Agent 卡片 → `AgentDetailModal` 開啟

**預期**：Modal 顯示 agent 詳情：name / description / curator rate / platform fee / total rate / curator wallet

**▸ 分岔 U3-1a：Marketplace 無 agent**
- **預期**：顯示「No agents available」+ 連結到 `/curator`

---

### U3-2｜從 Modal 開始 Session

**▸ 路徑 A：已連接錢包**
1. Modal 底部顯示 `Start Session →`
2. 點擊 `Start Session →`
3. 按鈕變 `Starting...`
4. 頁面自動導向 `/session/[id]`

**▸ 路徑 B：未連接錢包**
1. Modal 底部顯示 `Connect Wallet to Start`
2. 點擊 → 開啟 RainbowKit 連接
3. 連接成功後 → Modal 按鈕變為 `Start Session →`
4. 點擊 → 同路徑 A

**▸ 分岔 U3-2a：Start Session 失敗**
- 後端回錯（例如 agent 不存在或 inactive）
- **預期**：Modal 內顯示紅色錯誤「Failed to start session」，不離開 modal

---

### U3-3｜觀看 Live Session

1. 進入 `/session/[id]` 後自動連接 SSE stream
2. 觀察頁面三欄佈局：
   - **左欄**：SalaryTicker（金額每秒跳動）+ CostBreakdown（curator rate + platform fee）
   - **中欄**：AgentWorkTimeline（agent 步驟即時出現）
   - **右欄**：ProofHeartbeatTimeline（每 4 秒出現新 proof）
3. 觀察 StreamStatusBadge 顯示 `active`

**預期**：三欄持續更新；salary 每秒遞增

**▸ 分岔 U3-3a：SSE 斷線**
- 手動斷網再恢復
- **預期**：約 3 秒後自動重連；重連後繼續收事件

**▸ 分岔 U3-3b：Session 被暫停（外部觸發 proof timeout）**
- **預期**：收到 `status` SSE 事件 → StreamStatusBadge 變 `paused` → SalaryTicker 停止跳動

**▸ 分岔 U3-3c：Session 被停止**
- **預期**：StreamStatusBadge 變 `stopped` → SalaryTicker 停止 → 頁面底部出現 `Final Settlement` 面板，顯示 Total Charged / Curator Payout / Platform Fee

---

### U3-4｜與 Agent 對話

1. 在底部 `Chat with Agent` 輸入訊息
2. 按 Enter 或點 Send
3. 觀察 user 訊息氣泡 → `Thinking...` → model 回覆氣泡

**預期**：對話歷史持續增加；localStorage 自動保存

**▸ 分岔 U3-4a：發送失敗**
- 後端不可達 / session 不存在
- **預期**：model 氣泡顯示「Failed to reach AI.」

**▸ 分岔 U3-4b：重新進入同 session**
- 關掉分頁 → 重新開啟 `/session/[id]`
- **預期**：chat history 從 localStorage 讀回；SSE 重新連接

> **注意**：Session chat 目前**不帶簽名 headers** — 任何人知道 session ID 都能發訊息。

---

## Journey U4：付費查詢（Spot Query）

### U4-1｜選擇 Agent + Query Type → 付費 → 取得結果

1. 導航到 `/query`
2. 從 `Select Agent` 下拉選一個 agent
3. 選擇 Query Type（例如 `Analysis Summary — $0.001`）
4. 點擊 `Query for $0.001 →`
5. 收到 `Payment Required` 面板（顯示 Amount / Network: X Layer / Protocol: x402）
6. 點擊 `Pay $0.001 USDC →`
7. 等待 `Processing payment on X Layer...`（模擬 1.5 秒）
8. 觀察結果面板（summary / timestamp / price paid）

**預期**：結果成功顯示，包含 `Payment Confirmed — Analysis Unlocked` 標頭

**▸ 分岔 U4-1a：使用 Ask a Question 類型**
- 選 `Ask a Question` → 出現 Question 輸入框 → 輸入問題 → 同流程
- **預期**：結果顯示 question + answer
- **注意**：Question 為空也可以送出（按鈕不做空值檢查）

**▸ 分岔 U4-1b：使用 Full Evidence 類型**
- 選 `Full Evidence` → 同流程
- **預期**：結果顯示 proofCount + proof 列表

**▸ 分岔 U4-1c：付款失敗**
- 後端不可達
- **預期**：進入 error 狀態，顯示「Couldn't complete the query — try again in a moment.」+ `Try again` 按鈕

### U4-2｜重新查詢 / 切換 type

1. 在結果畫面點 `Query Again` → 狀態重置
2. 或在 error 畫面點 `Try again` → 回到 idle
3. 切換 Query Type → 先前結果自動清除

---

## Journey U5：查看 Session 歷史

### U5-1｜從 Sessions 頁進入歷史 Session

1. 導航到 `/sessions`
2. 觀察 session 列表（status / id / agent / time / cost）
3. 點擊一個 `stopped` 的 session → 進入 `/session/[id]`
4. 觀察 Final Settlement 面板

**預期**：頁面以 stopped 狀態呈現，有 Final Settlement 面板

**▸ 分岔 U5-1a：無任何 session**
- **預期**：顯示「還沒有任何 Session」+ 連結「前往 Marketplace 啟動第一個 Agent →」

---

# Part B — 策展人 (Curator)

## Journey C1：Curator 首次上傳 Skill 完整旅程 — 連錢包 → Manual Form 上傳 → 驗證上架

### C1-1｜連接錢包

同 U1-1。

---

### C1-2｜用 Manual Form 上傳 Skill

1. 導航到 `/upload`（透過 NavBar `Upload Skill` 或 `/skills` 頁的 `+ Upload Skill`）
2. 確認當前 tab 為 `Manual Form`
3. 填寫必填欄位：
   - `Skill Name`：例如 "DeFi Pool Analyzer"
   - `Description`：例如 "Analyzes pool data"
   - `System Prompt`：貼入 prompt 內容
4. 選擇 `Category`（例如 DeFi）和 `Execution Mode`（Once 或 Streaming）
5. 在 `User Prompt Template` 輸入含 `{{variable}}` 的模板（例如 `Analyze pool at {{address}} on {{chain}}`）
6. 點離輸入框（blur）→ 觀察 Input Fields 自動新增 `address` 和 `chain` 欄位
7. 設定 `Price per Run`（例如 3000 = $0.003000/run）
8. 點擊 `Publish Skill`
9. 簽名確認（action = `create-skill`）

**預期**：
- 發佈中顯示 `Publishing...`
- 若 System Prompt > 3000 字，會先自動壓縮
- 成功後導向 `/skills`，新 skill 出現在列表中
- 自己的 skill 顯示 `You` badge + `Delete` 按鈕

**▸ 分岔 C1-2a：缺少必填欄位**
- 不填 Name 直接 submit
- **預期**：顯示紅色錯誤「Name, description, and system prompt are required」

**▸ 分岔 C1-2b：未連接錢包**
- **預期**：按鈕 disabled，顯示 `Connect Wallet First`

**▸ 分岔 C1-2c：拒絕簽名**
- **預期**：前端 catch 錯誤，顯示紅色錯誤訊息，留在頁面

---

### C1-3｜驗證自己的 Skill 上架

1. 在 `/skills` 確認新 skill 出現
2. 點進 `/skills/[id]` 確認所有填的欄位正確顯示
3. 嘗試執行自己的 skill（同 U1-5 流程）確認可正常運行

---

## Journey C2：Curator 用 Import SKILL.md 上傳 Skill Pack

### C2-1｜上傳 SKILL.md + Pattern Files

1. 導航到 `/upload`
2. 切換到 `Import SKILL.md` tab
3. 上傳或貼入 SKILL.md 內容（含 frontmatter `---name/description---` + markdown body）
4. 觀察 Preview 面板出現：name / description / 「Will create: 1 master skill」

**▸ 分岔 C2-1a：SKILL.md 格式不合法**
- 貼入不含 frontmatter 的普通文字
- **預期**：Preview 面板不出現；嘗試 Submit → 顯示「Invalid SKILL.md format. Must have --- frontmatter ---」

### C2-2｜上傳 Pattern Files

1. 點 `+ Upload Pattern Files` → 選擇多個 .md 檔
2. 觀察列表顯示每個 pattern 的檔名 + 大小
3. Preview 更新為「Will create: 1 master skill + N pattern skills = N+1 total」
4. 可點 × 刪除某個 pattern → Preview 數量同步更新

### C2-3｜設定並發佈

1. 勾選/取消 `Auto-compress prompts`
2. 選 `Category` + 設定 `Price per Run`
3. 點 `Import (N skills)`
4. 簽名確認 → 每個 pattern skill 也需要各自簽名（多次簽名！）
5. 匯入過程中若開啟 auto-compress，顯示壓縮進度文字

**預期**：成功後導向 `/skills`；master skill + 各 pattern sub-skill 都出現在列表中

**▸ 分岔 C2-3a：多次簽名中途拒絕**
- 在第 2 個 pattern skill 簽名時拒絕
- **預期**：前端 catch 錯誤 → 顯示紅色錯誤。已建立的 master skill + 第 1 個 pattern 會留在 DB（部分成功狀態）

---

## Journey C3：Curator 管理自己的 Skill

### C3-1｜在列表頁刪除 Skill

1. 導航到 `/skills`
2. 切換到 `My Skills` tab
3. 在自己的 skill 卡片點 `Delete`
4. confirm 對話框 → 確認
5. 簽名確認（action = `delete-skill`）

**預期**：skill 從列表消失；reload 後仍不存在

**▸ 分岔 C3-1a：取消 confirm**
- **預期**：不刪除，列表不變

### C3-2｜在詳情頁刪除 Skill

1. 進入自己的 `/skills/[id]`
2. 點標題旁的 `Delete Skill`
3. confirm → 簽名

**預期**：自動導回 `/skills`

### C3-3｜非 Owner 看不到刪除按鈕

1. 用 A 錢包建立 skill → 斷開 → 用 B 錢包連接
2. 進入該 skill 的 `/skills/[id]`

**預期**：看不到 `Delete Skill` 按鈕；列表頁也看不到 `Delete` 按鈕和 `You` badge

---

## Journey C4：Curator 上傳 Agent → 驗證在 Marketplace

### C4-1｜建立 Agent

1. 導航到 `/curator/agents/new`（透過 NavBar `Upload Agent` → Dashboard → `Upload Agent` 按鈕）
2. 填寫所有欄位：
   - `Agent Name`
   - `Description`
   - `Category`（DeFi / Trading / Research）
   - `Analysis Template`（Pool Snapshot / Yield Compare）
   - `Rate`（micro-units/sec）→ 觀察下方即時換算（USDC/sec + user total pay）
   - `GitHub Repository URL`
3. 點擊 `Upload Agent →`

**預期**：成功後導向 `/marketplace`；新 agent 出現在列表中

**▸ 分岔 C4-1a：未連接錢包**
- **預期**：按鈕 disabled，顯示 `Connect Wallet First`

**▸ 分岔 C4-1b：必填欄位未填**
- 留空 GitHub URL
- **預期**：瀏覽器 HTML5 required validation 阻止送出

> **注意**：建立 Agent 頁面**目前不帶簽名 headers** — 這和其他寫入操作的 auth pattern 不一致。

---

### C4-2｜在 Marketplace 驗證上架

1. 導航到 `/marketplace`
2. 確認新 agent 出現在列表
3. 點擊新 agent → Modal 顯示正確的 name / description / rate

---

### C4-3｜在 Curator Dashboard 查看

1. 導航到 `/curator`
2. 確認 `Active Agents` 數量 +1
3. 確認 agent 列表出現新 agent，顯示 rate + status = Active

**▸ 分岔 C4-3a：未連接錢包進 Dashboard**
- **預期**：頁首顯示「Connect wallet to see your agents」；但列表可能仍顯示資料（依實作，前端 filter 在無 address 時不過濾）

---

## Journey C5：Curator 完整收益流程 — 上傳 Agent → 使用者開 Session → 查看收益

> 這是 curator 端到端的收益確認旅程。需要兩個角色（或同一人切兩個錢包）。

### C5-1｜Curator 上傳 Agent
同 C4-1。

### C5-2｜切換到 User 角色，開始 Session
同 U3-1 → U3-2。

### C5-3｜User 觀看 Session 運行一段時間
同 U3-3。觀察 SalaryTicker 持續累計。

### C5-4｜User 停止 Session
- 目前前端無直接 Stop 按鈕（stop 是由後端 API 或鏈上觸發）
- **預期**：session status 變 stopped → Final Settlement 出現

### C5-5｜切回 Curator，查看收益
1. 導航到 `/curator`
2. 觀察 `Total Earned` 是否更新

> **注意**：目前 `Total Earned` 在前端是硬編碼 `0`，非動態數據。真正的收益紀錄在後端 `curator_earnings` table，但前端 Dashboard 沒有 fetch 它。這是一個已知的未實作項。

---

# Part C — Trivial 檢查項（仍須確認但不是完整旅程）

> 以下是單步或兩步的基本驗證，不構成完整 journey 但仍需確認 pass。

## 導航

| # | 檢查項 | 預期 |
|---|--------|------|
| T-01 | 首頁 `/` 的 4 個連結（Browse Agents ×2, Upload Agent, Deploy Agent）都可點且導向正確 | 各自導向 /marketplace, /curator, /curator/agents/new |
| T-02 | NavBar 全部 7 個連結可點且導向正確 | 每個連結對應頁面正確載入 |
| T-03 | NavBar active 狀態正確 | 當前頁面對應的連結有 active 樣式 |
| T-04 | ManyMe logo 點擊回首頁 | 導向 `/` |

## 空狀態

| # | 頁面 | 觸發條件 | 預期 |
|---|------|---------|------|
| T-05 | `/marketplace` | 無 agent | 「No agents available」+ 連結到 /curator |
| T-06 | `/skills` — All tab | 無 skill | 「No skills found」+ 連結到 /upload |
| T-07 | `/skills` — My Skills tab | 已連接但無自己的 skill | 「You haven't uploaded any skills yet」+ 連結到 /upload |
| T-08 | `/skills` — My Skills tab | 未連接錢包 | 「Connect your wallet to see your skills」 |
| T-09 | `/sessions` | 無 session | 「還沒有任何 Session」+ 連結到 /marketplace |
| T-10 | `/curator` | 已連接但無 agent | 「No agents active」+ 連結到 upload |

## Loading 狀態

| # | 頁面 | 預期 |
|---|------|------|
| T-11 | `/marketplace` | 載入中顯示 3 個 loading skeleton |
| T-12 | `/skills` | 載入中顯示 `Loading skills...` |
| T-13 | `/sessions` | 載入中顯示 `Loading...` |
| T-14 | `/curator` | 載入中顯示 2 個 skeleton |
| T-15 | `/skills/[id]` | 載入中顯示 `Loading...`；skill 不存在顯示紅色 `Skill not found` |
| T-16 | `/query` — agent 下拉 | 載入中顯示 skeleton |

## Settings 頁

| # | 檢查項 | 預期 |
|---|--------|------|
| T-17 | 未連接錢包時所有區塊狀態 | 顯示「Connect your wallet to continue」 |
| T-18 | 3-Step Guide 狀態隨步驟更新 | Step 1 完成打勾 → 提示 Step 2；Step 2 完成打勾 → 提示 All set |
| T-19 | Balance Overview 三格數據正確 | Wallet USDC (鏈上) / Platform Balance (API) / Approved Limit (鏈上 allowance) |
| T-20 | Profile Save 存到 localStorage | 儲存後刷新仍在 |
| T-21 | USDC/Escrow 合約地址顯示正確 | 對比 Settings 頁顯示的地址和本文件上方的地址 |

## Session 頁

| # | 檢查項 | 預期 |
|---|--------|------|
| T-22 | `/session/new` 重導 | 自動導回 `/marketplace` |
| T-23 | Chat 空白送出 disabled | Send 按鈕 disabled，不可送出 |
| T-24 | Chat 歷史 localStorage 持久化 | 關掉分頁 → 重開同 session → 歷史仍在 |
| T-25 | SSE 斷線自動重連 | 斷網 → 恢復 → ~3 秒後重連成功 |

## Execution History

| # | 檢查項 | 預期 |
|---|--------|------|
| T-26 | All / Mine tab 切換正確 | Mine 只顯示自己錢包的 execution |
| T-27 | 未連接錢包時無 Mine tab | Mine tab 不出現 |
| T-28 | 匿名看到的 execution 遮罩 | 不應看到 input_json / output_text / error_message |

## Skill Upload 頁

| # | 檢查項 | 預期 |
|---|--------|------|
| T-29 | Manual / Import tab 切換 | 兩種模式正常切換，不丟失暫存狀態 |
| T-30 | `+ Add Field` + 刪除 | 可新增/刪除 input fields |
| T-31 | `{{variable}}` 自動偵測 | blur User Prompt Template 後自動新增欄位 |
| T-32 | Pattern file 上傳 + 刪除 | 上傳 .md → 列表出現 → 可刪除 → Preview 數量同步 |

---

## 已知問題備忘（測試時以實際行為記錄，但這些是已知的 gap）

| # | 問題 | 影響 |
|---|------|------|
| K-01 | **建立 Agent (`/curator/agents/new`) 不帶簽名 headers** | 與其他寫入操作 auth pattern 不一致 |
| K-02 | **Session Chat 不帶簽名 headers** | 任何人可對任意 session 發訊息 |
| K-03 | **Curator Dashboard `Total Earned` 為前端硬編碼 0** | 不反映真實收益 |
| K-04 | **Curator Dashboard 未連接錢包時仍可能顯示 agent 列表** | filter 在無 address 時不過濾 |
| K-05 | **Skill Run 按鈕在餘額不足時不 disable** | 使用者可強行執行，由後端擋 |
| K-06 | **Query 頁 Ask 問題為空也可送出** | 按鈕不做空值檢查 |
| K-07 | **多數列表頁 fetch 失敗無獨立錯誤 UI** | 直接落成空狀態而非顯示 error banner |
| K-08 | **Import SKILL.md 多次簽名中途失敗會導致部分 skills 已建立** | 無 rollback 機制 |
| K-09 | **Deposit 目前是 demo 模式** | 只寫 DB 不動鏈上 USDC；但 Approve 是真的鏈上交易 |
