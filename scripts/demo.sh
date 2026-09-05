#!/bin/bash
set -e

echo "🚀 ManyMe Demo Setup"
echo "========================"

# Colors
GREEN='\033[0;32m'
TEAL='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Kill any stale process on port 3001
lsof -ti :3001 | xargs kill 2>/dev/null || true
sleep 1

echo -e "${TEAL}1. Starting backend...${NC}"
cd backend
bun run src/db/init.ts
bun run src/server.ts &
BACKEND_PID=$!
sleep 3
echo -e "${GREEN}   ✅ Backend running on http://localhost:3001${NC}"

echo -e "${TEAL}2. Verifying demo agents...${NC}"
AGENTS=$(curl -s http://localhost:3001/api/agents | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
echo -e "${GREEN}   ✅ $AGENTS agents in catalog${NC}"

echo -e "${TEAL}3. Creating demo session...${NC}"
AGENT_ID=$(curl -s http://localhost:3001/api/agents | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
SESSION_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
sqlite3 dev.db "INSERT INTO sessions (id, agent_id, user_wallet, status, total_rate, curator_rate, platform_fee, deposit_amount, started_at) VALUES ('${SESSION_ID}', '${AGENT_ID}', '0xdemouser', 'active', 1300, 1000, 300, 5000000, datetime('now'))"
echo -e "${GREEN}   ✅ Session: $SESSION_ID${NC}"

echo -e "${TEAL}4. Starting frontend...${NC}"
cd ../frontend
bun run dev &
FRONTEND_PID=$!
sleep 5
echo -e "${GREEN}   ✅ Frontend running on http://localhost:3000${NC}"

echo ""
echo -e "${YELLOW}Demo URLs:${NC}"
echo "  Landing:     http://localhost:3000"
echo "  Marketplace: http://localhost:3000/marketplace"
echo "  Session:     http://localhost:3000/session/$SESSION_ID"
echo "  Curator:     http://localhost:3000/curator"
echo "  Query:       http://localhost:3000/query"
echo "  Backend API: http://localhost:3001"
echo ""
echo -e "${YELLOW}Demo Flow:${NC}"
echo "  1. Open Marketplace → Select 'DeFi Pool Analyst'"
echo "  2. Click 'Start Session' → Watch salary ticker"
echo "  3. See proof heartbeats every 3-5 seconds"
echo "  4. Kill backend (Ctrl+C) → Watch counter freeze"
echo "  5. Restart → Counter resumes"
echo "  6. Go to /query → Pay \$0.001 for spot analysis"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Demo stopped'" EXIT
wait
