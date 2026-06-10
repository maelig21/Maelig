#!/bin/bash
# hermes-deploy — Wrapper deploy qui FORCE la cascade Djibril Chinois
#
# Usage : bash ~/agence-ia/manager/hermes-deploy.sh "<description de la tâche>"
#
# 1. Résumé T0 dans RECENT.md
# 2. Challenge T1 via tier_dispatch
# 3. Si OK → git push + vercel deploy
#

set -e

TASK_DESC="${1:-}"
RECENT_LOG="$HOME/agence-ia/manager/_log_recent.sh"
TIER="$HOME/agence-ia/manager/tier_dispatch.sh"
RECENT_FILE="$HOME/.hermes/memories/RECENT.md"
GLOBAL="$HOME/.hermes/memories/GLOBAL_MEMORY.md"

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  DJIBRIL CHINOIS — GATE DE DÉPLOIEMENT             ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── Étape 1 : Résumé ──
if [ -z "$TASK_DESC" ]; then
  echo "❌ Usage : hermes-deploy.sh \"<description de la tâche>\""
  echo "   Décris ce que tu t'apprêtes à déployer en 2-3 lignes max."
  exit 1
fi

echo "📋 TÂCHE : $TASK_DESC"
echo ""

# ── Étape 2 : Challenge T1 ──
echo "⏳ Challenge T1 en cours..."
CHALLENGE_OUTPUT=$(bash "$TIER" "$TASK_DESC" --type=challenge 2>&1) || true
echo "$CHALLENGE_OUTPUT" | head -20
echo ""

# Vérifie si le challenge mentionne des problèmes
if echo "$CHALLENGE_OUTPUT" | grep -qi "fail\|error\|problème\|attention\|⚠️\|❌"; then
  echo "⚠️  Le T1 challenge a signalé des points d'attention."
  echo "   Vérifie manuellement avant de forcer le déploiement."
  echo "   Tape Ctrl+C pour annuler, ou Entrée pour continuer."
  read -r
fi

# ── Étape 3 : Commit & Push ──
echo "⬆️  Push en cours..."
cd ~/projects/dep-electrique/web
git push origin main 2>&1 | tail -5
echo ""

# ── Étape 4 : Déploiement Vercel ──
echo "🚀 Déploiement Vercel..."
vercel deploy --prod --yes 2>&1 | tail -5
echo ""

# ── Étape 5 : Log ──
bash "$RECENT_LOG" "HERMES-DEPLOY" "CASCADE ✅ $TASK_DESC"
echo "✅ Déploiement terminé."
