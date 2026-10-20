#!/usr/bin/env bash
# ==============================================================================
# Task Reminder - Full Stack Builder (Next.js Frontend + Go Fiber Backend)
# ==============================================================================

set -e

# Terminal colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}   Task Reminder - Production Builder (Go + Next.js)  ${NC}"
echo -e "${CYAN}======================================================${NC}"

# Check prerequisites
if ! command -v go >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Go (golang) is not installed or not in PATH.${NC}"
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Node.js is not installed or not in PATH.${NC}"
    exit 1
fi

# Detect pnpm package manager
PNPM_CMD="pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
    if command -v npx >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  pnpm command not found globally, falling back to npx pnpm...${NC}"
        PNPM_CMD="npx pnpm"
    else
        echo -e "${RED}❌ Error: Neither pnpm nor npx is available.${NC}"
        exit 1
    fi
fi

# 1. Install workspace dependencies if needed
echo ""
echo -e "${YELLOW}[1/3] Checking workspace dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "Installing dependencies via $PNPM_CMD..."
    $PNPM_CMD install
else
    echo -e "${GREEN}✓ Dependencies already installed.${NC}"
fi

# 2. Build Next.js 16 Frontend
echo ""
echo -e "${YELLOW}[2/3] Building Next.js Frontend...${NC}"
$PNPM_CMD --filter @task-reminder/frontend build
echo -e "${GREEN}✓ Frontend build completed (.next ready).${NC}"

# 3. Build Go Fiber Backend
echo ""
echo -e "${YELLOW}[3/3] Compiling Go Fiber Backend...${NC}"
mkdir -p bin
mkdir -p data

cd backend

TARGET_BIN="../bin/server"
if [ "$OS" = "Windows_NT" ]; then
    TARGET_BIN="../bin/server.exe"
fi

CGO_ENABLED=0 go build -ldflags="-s -w" -o "$TARGET_BIN" ./cmd/server
cd ..

echo -e "${GREEN}✓ Go server compiled successfully ($TARGET_BIN).${NC}"

echo ""
echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}🎉 Build Completed Successfully!${NC}"
echo -e "${CYAN}======================================================${NC}"
echo -e "Outputs:"
echo -e "  - Frontend: frontend/.next"
echo -e "  - Backend:  $TARGET_BIN"
echo -e "  - Data dir: ./data"
echo ""
echo -e "Cara Menjalankan:"
echo -e "  1. Menjalankan via PM2 (rekomendasi):"
echo -e "     ${YELLOW}pm2 start ecosystem.config.js${NC}"
echo ""
echo -e "  2. Menjalankan manual:"
echo -e "     ${YELLOW}pnpm start:backend &${NC}"
echo -e "     ${YELLOW}pnpm start:frontend${NC}"
echo -e "${CYAN}======================================================${NC}"
