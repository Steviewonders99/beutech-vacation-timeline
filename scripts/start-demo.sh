#!/bin/bash
#
# Demo Server Script
# Starts the backend and creates a shareable public URL
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

# Check for cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared not found. Installing..."
    brew install cloudflared
fi

# Check for func
if ! command -v func &> /dev/null; then
    echo "Azure Functions Core Tools not found."
    echo "Install with: brew install azure-functions-core-tools@4"
    exit 1
fi

# Kill any existing processes
echo "Cleaning up existing processes..."
lsof -ti:7071 | xargs kill -9 2>/dev/null || true
pkill cloudflared 2>/dev/null || true
sleep 1

# Navigate to backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../apps/backend"

echo ""
echo -e "${BLUE}Starting Azure Functions backend...${NC}"
func start > /tmp/func-demo.log 2>&1 &
FUNC_PID=$!

echo "Waiting for backend to start..."
for i in {1..15}; do
    if curl -s http://localhost:7071/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Check if backend is running
if ! curl -s http://localhost:7071/api/health > /dev/null 2>&1; then
    echo "Backend failed to start. Check /tmp/func-demo.log"
    cat /tmp/func-demo.log | tail -20
    exit 1
fi

echo -e "${GREEN}✓ Backend running on localhost:7071${NC}"

echo ""
echo -e "${BLUE}Starting Cloudflare tunnel...${NC}"

# Start cloudflared and capture URL
cloudflared tunnel --url http://localhost:7071 > /tmp/cf-tunnel.log 2>&1 &
CF_PID=$!

echo "Waiting for tunnel..."
sleep 8

# Extract URL
TUNNEL_URL=$(grep -o 'https://[^|]*trycloudflare.com' /tmp/cf-tunnel.log | head -1 | tr -d ' ')

if [ -z "$TUNNEL_URL" ]; then
    echo "Failed to get tunnel URL. Check /tmp/cf-tunnel.log"
    cat /tmp/cf-tunnel.log
    exit 1
fi

echo ""
echo "============================================"
echo -e "${GREEN}  DEMO IS READY!${NC}"
echo "============================================"
echo ""
echo -e "${YELLOW}Share this URL:${NC}"
echo ""
echo "  $TUNNEL_URL"
echo ""
echo -e "${BLUE}Test endpoints:${NC}"
echo "  Health:      ${TUNNEL_URL}/api/health"
echo "  Diagnostics: ${TUNNEL_URL}/api/diagnostics (needs x-api-key header)"
echo ""
echo "============================================"
echo ""
echo "Press Ctrl+C to stop the demo server"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping demo..."
    kill $FUNC_PID 2>/dev/null || true
    kill $CF_PID 2>/dev/null || true
    pkill cloudflared 2>/dev/null || true
    echo "Demo stopped."
}
trap cleanup EXIT

# Keep running
wait $CF_PID
