#!/bin/bash

# AI Forum - Quick Setup Script
# Run this from the ai-forum-app folder

set -e  # Exit on error

echo ""
echo "🤖 AI Forum - Quick Setup"
echo "========================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. You have $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Copy .env to apps/api if not exists
if [ ! -f "apps/api/.env" ]; then
    echo "📋 Copying .env to apps/api..."
    cp .env apps/api/.env
fi

# Install API dependencies
echo "📦 [1/4] Installing API dependencies..."
cd apps/api
npm install
cd ../..

# Install Web dependencies
echo "📦 [2/4] Installing Web dependencies..."
cd apps/web
npm install
cd ../..

# Push database schema
echo ""
echo "🗃️  [3/4] Setting up database schema..."
cd apps/api
npm run db:push

# Seed data
echo ""
echo "🌱 [4/4] Seeding initial data..."
npm run seed
cd ../..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Terminal 1: cd apps/api && npm run dev"
echo "  2. Terminal 2: cd apps/web && npm run dev"
echo "  3. Generate:   cd apps/api && npm run generate thread 3"
echo ""
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:3001"
