#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── Pre-flight checks ──
echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

command -v bun  >/dev/null 2>&1 || { echo -e "${RED}bun not found. Install: curl -fsSL https://bun.sh/install | bash${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}pnpm not found. Install: npm i -g pnpm${NC}"; exit 1; }

if [ ! -f .env ]; then
  echo -e "${RED}.env file not found. Copy .env.example and fill in your keys.${NC}"
  exit 1
fi

# ── Load env ──
set -a
source .env
set +a

if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${RED}GEMINI_API_KEY not set in .env${NC}"
  exit 1
fi

# ── Install dependencies ──
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Init DB ──
echo -e "${YELLOW}[3/5] Initializing database...${NC}"
cd "$ROOT_DIR/backend"
bun run src/db/init.ts

# ── Kill existing processes on ports ──
echo -e "${YELLOW}[4/5] Starting services...${NC}"
lsof -ti :${PORT:-3001} 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# ── Start backend ──
cd "$ROOT_DIR/backend"
bun run src/server.ts &
BACKEND_PID=$!
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo -e "${RED}Backend failed to start. Check if port ${PORT:-3001} is in use.${NC}"
  exit 1
fi

# ── Start frontend ──
cd "$ROOT_DIR/frontend"
pnpm dev &
FRONTEND_PID=$!
sleep 4

# ── Health check ──
echo -e "${YELLOW}[5/5] Health check...${NC}"
if curl -sf http://localhost:${PORT:-3001}/health > /dev/null 2>&1; then
  echo -e "${GREEN}Backend:  http://localhost:${PORT:-3001} ✓${NC}"
else
  echo -e "${RED}Backend health check failed${NC}"
fi
echo -e "${GREEN}Frontend: http://localhost:3000 ✓${NC}"

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  ManyMe is running!${NC}"
echo -e "${GREEN}  Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}  Backend:  http://localhost:${PORT:-3001}${NC}"
echo -e "${GREEN}  Skills:   http://localhost:3000/skills${NC}"
echo -e "${GREEN}  Upload:   http://localhost:3000/upload${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# ── Cleanup on exit ──
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  lsof -ti :${PORT:-3001} 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# ── Wait ──
wait
