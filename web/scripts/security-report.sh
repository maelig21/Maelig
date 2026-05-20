#!/usr/bin/env bash
# DEP — Security aggregated report
# Usage : pnpm security:report
# Exit code : 0 si tout OK, 1 si findings ERROR
set -u

cd "$(dirname "$0")/.."

mkdir -p reports
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
OUT="reports/security-${TS}.md"

declare -i ERRORS=0

header() { printf '\n## %s\n\n' "$*" >> "$OUT"; }
ok()     { printf '✅ %s\n' "$*" >> "$OUT"; }
warn()   { printf '⚠️  %s\n' "$*" >> "$OUT"; }
fail()   { printf '🔴 %s\n' "$*" >> "$OUT"; ERRORS+=1; }

REPO=$(git rev-parse --show-toplevel 2>/dev/null || echo n/a)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)
HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo n/a)
{
  printf '# DEP — Security audit report\n\n'
  printf '> Run UTC: %s\n' "$TS"
  printf '> Repo: %s\n' "$REPO"
  printf '> Branch: %s\n' "$BRANCH"
  printf '> HEAD: %s\n\n' "$HEAD"
  printf 'Outils : pnpm audit, gitleaks, semgrep, eslint-plugin-security, tsc.\n'
} > "$OUT"

# 1) pnpm audit
header "Dependencies (pnpm audit)"
if pnpm audit --prod --audit-level=high --json > /tmp/sec-audit.json 2>/dev/null; then
  ok "Aucune vuln high/critical sur deps prod."
else
  CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' /tmp/sec-audit.json 2>/dev/null || echo 0)
  HIGH=$(jq '.metadata.vulnerabilities.high // 0' /tmp/sec-audit.json 2>/dev/null || echo 0)
  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    fail "Vulnérabilités prod : ${CRITICAL} critical, ${HIGH} high"
  else
    warn "Vulnérabilités moderate uniquement (cf pnpm audit)"
  fi
fi
pnpm audit --prod --audit-level=moderate 2>&1 | sed -n '/CVE/,/^$/p' | head -40 >> "$OUT" || true

# 2) Gitleaks
header "Secrets scan (gitleaks)"
if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --no-banner --redact --source=. -r /tmp/sec-gitleaks.json >/dev/null 2>&1; then
    ok "Aucun secret détecté dans le repo."
  else
    LEAKS=$(jq 'length' /tmp/sec-gitleaks.json 2>/dev/null || echo 0)
    fail "${LEAKS} fuites potentielles détectées"
    jq -r '.[] | "- \(.RuleID) — \(.File):\(.StartLine)"' /tmp/sec-gitleaks.json 2>/dev/null | head -20 >> "$OUT"
  fi
else
  warn "gitleaks non installé (brew install gitleaks)"
fi

# 3) Semgrep
header "Static analysis (semgrep — OWASP + Next + JWT)"
if command -v semgrep >/dev/null 2>&1; then
  semgrep \
    --config=p/owasp-top-ten \
    --config=p/javascript \
    --config=p/typescript \
    --config=p/nextjs \
    --config=p/react \
    --config=p/jwt \
    --config=p/secrets \
    --metrics=off \
    --severity ERROR --severity WARNING \
    --json -o /tmp/sec-semgrep.json \
    src/ >/dev/null 2>&1 || true
  COUNT=$(jq '.results | length' /tmp/sec-semgrep.json 2>/dev/null || echo 0)
  if [ "$COUNT" -eq 0 ]; then
    ok "Semgrep: 0 finding."
  else
    fail "Semgrep: ${COUNT} findings"
    jq -r '.results[] | "- [\(.extra.severity)] \(.check_id) — \(.path):\(.start.line)"' /tmp/sec-semgrep.json 2>/dev/null | head -30 >> "$OUT"
  fi
else
  warn "semgrep non installé (pipx install semgrep)"
fi

# 4) ESLint security — on tolère les errors non-security (JSX entities etc.)
header "ESLint security plugin"
pnpm exec eslint --no-warn-ignored 'src/**/*.{ts,tsx}' --format json -o /tmp/sec-eslint.json >/dev/null 2>&1 || true
if [ -s /tmp/sec-eslint.json ]; then
  COUNT=$(jq '[.[] | .messages[] | select(.ruleId | tostring | startswith("security/")) | select(.severity == 2)] | length' /tmp/sec-eslint.json 2>/dev/null || echo 0)
  WARN_COUNT=$(jq '[.[] | .messages[] | select(.ruleId | tostring | startswith("security/")) | select(.severity == 1)] | length' /tmp/sec-eslint.json 2>/dev/null || echo 0)
  if [ "$COUNT" -eq 0 ]; then
    ok "ESLint security: 0 error (${WARN_COUNT} warnings)."
  else
    fail "ESLint security: ${COUNT} errors, ${WARN_COUNT} warnings"
    jq -r '.[] | .filePath as $f | .messages[] | select(.ruleId | tostring | startswith("security/")) | "- [\(.severity)] \(.ruleId) — \($f):\(.line)"' /tmp/sec-eslint.json 2>/dev/null | head -20 >> "$OUT"
  fi
else
  warn "ESLint report empty"
fi

# 5) TypeScript strict — informational only (next.config has ignoreBuildErrors)
header "TypeScript strict (informationnel)"
TSC_OUT=$(pnpm exec tsc --noEmit 2>&1 | head -20)
TSC_COUNT=$(echo "$TSC_OUT" | grep -c "error TS" || echo 0)
if [ "$TSC_COUNT" -eq 0 ]; then
  ok "tsc --noEmit OK"
else
  warn "tsc: ${TSC_COUNT}+ errors (cf next.config ignoreBuildErrors=true)"
  echo '```' >> "$OUT"
  echo "$TSC_OUT" | head -5 >> "$OUT"
  echo '```' >> "$OUT"
fi

# Summary
{
  printf '\n## Summary\n\n'
  if [ "$ERRORS" -gt 0 ]; then
    printf '🔴 **%d categories with ERRORS** — block deploy.\n' "$ERRORS"
  else
    printf '✅ Aucun blocker. Build production OK.\n'
  fi
} >> "$OUT"

echo "Report → $OUT"
exit $([ "$ERRORS" -gt 0 ] && echo 1 || echo 0)
