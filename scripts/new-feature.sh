#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: ./scripts/new-feature.sh <feature-name>"
  echo "Example: ./scripts/new-feature.sh panel-improvements"
  exit 1
fi

BRANCH="feature/$1"
echo "🌿 Creating branch: $BRANCH"
git checkout main
git pull origin main
git checkout -b "$BRANCH"
echo "✅ Ready! Now work on your feature and run ./dev.sh to test locally"
