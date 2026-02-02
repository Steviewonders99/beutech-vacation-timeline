#!/bin/bash
#
# Demo Server Script
# Starts the backend and creates a shareable ngrok URL
#
# Usage: ./scripts/start-demo.sh
#

set -e

echo "============================================"
echo "  Vacation Timeline - Demo Server"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check for ngrok
if ! command -v ngrok &> /dev/null; then
    echo "ngrok not found. Install with: brew install ngrok"
    exit 1
fi

# Check for func
if ! command -v func &> /dev/null; then
    echo "Azure Functions Core Tools not found."
    echo "Install with: brew install azure-functions-core-tools@4"
    exit 1
fi

# Kill any existing processes on port 7071
echo "Cleaning up existing processes..."
lsof -ti:7071 | xargs kill -9 2>/dev/null || true
sleep 1

# Navigate to backend
cd "$(dirname "$0")/../apps/backend"

echo ""
echo -e "${BLUE}Starting Azure Functions backend...${NC}"
func start > /tmp/func-demo.log 2>&1 &
FUNC_PID=$!

echo "Waiting for backend to start..."
sleep 8

# Check if backend is running
if ! curl -s http://localhost:7071/api/health > /dev/null 2>&1; then
    echo "Backend failed to start. Check /tmp/func-demo.log"
    exit 1
fi

echo -e "${GREEN}✓ Backend running on localhost:7071${NC}"

echo ""
echo -e "${BLUE}Starting ngrok tunnel...${NC}"
echo ""

# Start ngrok (this will show the URL)
echo "============================================"
echo -e "${GREEN}  SHARE THIS URL WITH C-SUITE:${NC}"
echo "============================================"
echo ""

# Run ngrok in foreground so we can see the URL
ngrok http 7071 --log=stdout

# Cleanup on exit
trap "kill $FUNC_PID 2>/dev/null; echo 'Demo stopped.'" EXIT
