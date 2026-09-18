#!/bin/bash
# BRC INFRA - Transport ERP Startup Script
# Run this to start both backend and frontend servers

echo "================================================"
echo "  BRC INFRA - Transport Management System"
echo "================================================"

# Kill any existing servers
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start MongoDB if not running
if ! mongosh --eval "db.adminCommand({ping:1})" --quiet 2>/dev/null | grep -q "ok"; then
  echo "Starting MongoDB..."
  mkdir -p "$HOME/data/db"
  mongod --dbpath "$HOME/data/db" --port 27017 --fork --logpath /tmp/mongod.log 2>&1
  sleep 2
  echo "MongoDB started."
else
  echo "✅ MongoDB already running."
fi

# Start Backend
echo ""
echo "Starting Backend Server (port 5001)..."
cd "$(dirname "$0")/backend"
node server.js > /tmp/brc-backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check backend
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
  echo "✅ Backend running at http://localhost:5001"
else
  echo "❌ Backend failed to start. Check /tmp/brc-backend.log"
  cat /tmp/brc-backend.log | tail -5
fi

# Start Frontend
echo ""
echo "Starting Frontend (port 3000)..."
cd "$(dirname "$0")"
npm run dev > /tmp/brc-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 5

echo ""
echo "================================================"
echo "  ✅ BRC INFRA Started Successfully!"
echo "  Open: http://localhost:3000"
echo "================================================"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop: run ./stop.sh or press Ctrl+C"

# Keep running and show logs
tail -f /tmp/brc-backend.log
