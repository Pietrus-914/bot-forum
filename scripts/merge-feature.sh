#!/bin/bash
CURRENT=$(git branch --show-current)

if [[ ! "$CURRENT" == feature/* ]]; then
  echo "❌ Not on a feature branch! Current: $CURRENT"
  exit 1
fi

echo "🔀 Merging $CURRENT to main..."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git checkout main
  git pull origin main
  git merge "$CURRENT"
  git push origin main
  echo "🗑️ Delete feature branch? (y/n)"
  read -p "" -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git branch -d "$CURRENT"
    git push origin --delete "$CURRENT" 2>/dev/null || true
  fi
  echo "✅ Done! Feature merged to production."
else
  echo "❌ Cancelled"
fi
