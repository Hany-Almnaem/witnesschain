#!/bin/bash

# WitnessChain Local Development Startup Script

echo "🚀 Starting WitnessChain Development Environment..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js v18 or higher."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if backend dependencies are installed
if [ ! -d "packages/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd packages/backend && npm install && cd ../..
    echo ""
fi

# Check if frontend dependencies are installed
if [ ! -d "packages/frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd packages/frontend && npm install && cd ../..
    echo ""
fi

echo "🎯 Starting development servers..."
echo ""
echo "📱 Frontend will be available at: http://localhost:5173"
echo "🔧 Backend API will be available at: http://localhost:3000"
echo "🏥 Health check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers
npm run dev
