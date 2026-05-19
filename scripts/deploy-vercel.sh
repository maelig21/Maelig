#!/usr/bin/env bash
# DEP — déploiement Vercel automatique
# Usage: ./scripts/deploy-vercel.sh [--prod]
# Prérequis : `vercel login` (1ère fois uniquement)
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI manquant. Installer : npm i -g vercel"
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "🔐 Pas connecté à Vercel. Lance : vercel login"
  exit 1
fi

cd web

PROD_FLAG="${1:-}"

# Link project (idempotent)
if [ ! -d .vercel ]; then
  echo "🔗 Liaison du projet Vercel..."
  vercel link --yes
fi

# Push env vars from .env.local to Vercel preview & production
if [ -f .env.local ]; then
  echo "📦 Synchronisation des variables d'environnement..."
  while IFS='=' read -r key value || [ -n "$key" ]; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    value="${value%\"}"; value="${value#\"}"
    echo "  → $key"
    echo "$value" | vercel env add "$key" production 2>/dev/null || true
    echo "$value" | vercel env add "$key" preview 2>/dev/null || true
  done < .env.local
fi

if [ "$PROD_FLAG" = "--prod" ]; then
  echo "🚀 Déploiement PRODUCTION"
  vercel deploy --prod --yes
else
  echo "🛠  Déploiement PREVIEW"
  vercel deploy --yes
fi
