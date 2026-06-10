# DOCTRINE_DEP_ELECTRIQUE.md — v1.0 (2026-05-26)
> 🔒 FICHIER VERROUILLÉ. Ne pas modifier sans validation T0+T1.
> Toute config business dans `app_config['dep_electrique']` Supabase.

---

## 1. PRINCIPE

DEP est un SaaS B2B français pour électriciens. Transformer vocal en devis < 2 min. Relances clients automatiques. Équipe multi-rôle (owner, slave, admin_dep).

## 2. CONFIG CENTRALISÉE

**Toute la config est dans Supabase `app_config['dep_electrique']` :**

| Clé | Type | Source unique |
|-----|------|--------------|
| `admin_emails` | array | ✅ **UNIQUE** — plus de duplication |
| `resend_from` | string | Expéditeur email par défaut |
| `site_url` | string | URL production |
| `stripe_trial_days` | int | Durée essai |
| `taux_horaire_default` | float | TVA par défaut |
| `relance_hebdo_jours` | int | Jours entre relances hebdo |
| `relance_quotidienne_after` | int | Jours avant relance quotidienne |
| `relance_finale_after` | int | Jours avant relance finale |
| `draft_ttl_ms` | int | TTL brouillons (ms) |
| `cron_relance_hour` | int | Heure d'envoi des relances |

**Lecteurs officiels :**
- **TypeScript** : `src/lib/config-reader.ts` → `depConfig(key, default)`, `getAdminEmails()`

## 3. ADMIN EMAILS — NE PLUS DUPLIQUER

Les emails admin sont **UNIQUEMENT** dans `app_config['dep_electrique'].admin_emails`.
NE PAS les hardcoder dans :
- ❌ `src/app/app/admin/_lib.ts`
- ❌ `src/app/api/admin/test-email/route.ts`
- ❌ migrations SQL `handle_new_user()`

Toujours utiliser : `await getAdminEmails()` depuis `@/lib/config-reader`.

## 4. RELANCES CLIENTS

- **Cron** : Vercel Cron `0 9 * * *` → `/api/relances/run`
- **Templates** : `src/lib/email/templates.ts` (hebdo, quotidienne, finale)
- **Driver** : Resend API
- **Config** : `app_config['dep_electrique']` (relance_* clés)

## 5. LLM ROUTING (Djibril Chinois)

| Besoin | Modèle | Endpoint |
|--------|--------|----------|
| ASR | paraformer-v2 | DashScope async |
| Correction FR | qwen-turbo | DashScope |
| Extraction JSON | qwen-plus | DashScope |
| Reasoning | deepseek-v4-pro | DeepSeek natif |

## 6. RÈGLES DE MODIFICATION

1. **Config business** → modifier `app_config['dep_electrique']` Supabase
2. **Code** → cascade T0→T4→T1→exec
3. **NE JAMAIS hardcoder** admin_emails, URLs, valeurs métier
4. **Migration DB** → SQL dans `supabase/migrations/` + psql
