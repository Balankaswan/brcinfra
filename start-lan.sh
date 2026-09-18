#!/bin/bash

# BRC Transport Management - LAN Startup Script
echo "🚀 Starting BRC Transport Management System for LAN Access"
echo "=================================================="

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   - Open MongoDB Compass, or"
    echo "   - Run: brew services start mongodb/brew/mongodb-community"
    echo "   - Or run: mongod"
    exit 1
fi

echo "✅ MongoDB is running"

# Get LAN IP address
LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$LAN_IP" ]; then
    echo "❌ Could not detect LAN IP address"
    echo "Please check your network connection and try again"
    exit 1
fi

echo "🌐 Detected LAN IP: $LAN_IP"

# Create .env file with correct IP
cat > .env << EOF
VITE_API_URL=http://$LAN_IP:5000/api
EOF

echo "✅ Created .env file with LAN IP"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

echo "🎯 Starting servers..."
echo "   Frontend: http://$LAN_IP:3000"
echo "   Backend:  http://$LAN_IP:5001"
echo "   Health:   http://$LAN_IP:5001/health"
echo ""
echo "📱 Access from any device on your WiFi network:"
echo "   http://$LAN_IP:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=================================================="

# Start both frontend and backend
npm run start:full
