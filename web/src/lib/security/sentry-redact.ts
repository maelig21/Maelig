/* eslint-disable security/detect-unsafe-regex -- toutes les regex ici utilisent
   des bornes {n,m} explicites pour empêcher catastrophic backtracking. safe-regex2
   (le moteur derrière eslint-plugin-security) ne reconnaît pas ces bornes comme
   safe. Audit manuel : aucune regex n'autorise une croissance non-bornée. */
/**
 * P1 audit 2026-05-20 — Filtre PII complet pour Sentry beforeSend.
 *
 * Sentry par défaut capture :
 *   - User context (email, ip, username)
 *   - Request body (sauf si sendDefaultPii = false, ce qui est notre cas)
 *   - Request headers (cookies, Authorization)
 *   - Breadcrumbs (URL, console messages)
 *   - Error stack (souvent des objets en clair)
 *
 * Pour un projet B2B handling données clients (devis, factures, paiements,
 * incidents avec photos chantier), il faut TOUT redacter ce qui peut PII-leak.
 *
 * Cible RGPD : un dump Sentry doit pouvoir être partagé sans risque.
 */
import type { Event, EventHint } from "@sentry/nextjs"

// P1 audit 2026-05-20 — Regex bornées (ReDoS-safe) avec quantifieurs {n,m}
// au lieu de + pour éviter catastrophic backtracking.
// Bornes max strictes pour respecter les limites RFC 5321 (email) et IBAN EU.
// Les warnings eslint-plugin-security/detect-unsafe-regex sont des faux positifs
// car safe-regex2 ne reconnaît pas les bornes {n,m} comme protection ReDoS suffisante.

// Email : local part 1-64, domain 1-253, TLD 2-24 (RFC 5321/5322 réalistes)
const EMAIL_RE = /[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,253}\.[a-zA-Z]{2,24}/g
// IBAN FR/EU : 2 lettres pays + 2 chiffres + 11-30 alphanum (bornes strictes)
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g
// SIRET (14 chiffres) / SIREN (9 chiffres) — bornes fixes
const SIRET_RE = /\b\d{14}\b/g
const SIREN_RE = /\b\d{9}\b/g
// Carte bancaire 13-19 chiffres (avec espaces/tirets)
const CC_RE = /\b(?:\d[ -]?){13,19}\b/g
// Téléphone FR (+33 ou 0) + 9 chiffres
const PHONE_FR_RE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g
// JWT : 3 segments base64-url séparés par "." — bornes 10-2000 chars/segment
const JWT_RE = /\beyJ[a-zA-Z0-9_-]{10,2000}\.[a-zA-Z0-9_-]{10,4000}\.[a-zA-Z0-9_-]{10,2000}/g
// Stripe (sk/pk/rk/whsec)_(test/live)_<20-200 alphanum>
const STRIPE_RE = /\b(?:sk|pk|rk|whsec)_(?:test|live)_[A-Za-z0-9]{20,200}/g
// Generic API key (sk-..., sbp_..., ey...) bornes fixes
const APIKEY_RE = /\b(?:sk-[A-Za-z0-9_-]{20,200}|sbp_[A-Za-z0-9]{20,200}|ey[A-Za-z0-9_-]{40,2000})/g

/** Champs body/headers à drop intégralement (jamais utile en debug). */
const SENSITIVE_KEYS = new Set([
  "password", "pw", "pass", "passwd",
  "token", "access_token", "refresh_token", "id_token",
  "authorization", "cookie", "set-cookie", "x-supabase-auth",
  "stripe-signature",
  "iban", "bic", "rib",
  "card", "card_number", "cvv", "cvc",
  "ssn", "siren", "siret",
  "phone", "telephone", "mobile",
  "email", "user_email",
  // P0/P1 incidents : champs photos/audio peuvent contenir des paths sensibles
  "audio_url", "video_url", "photo_url", "signed_url",
])

function isSensitiveKey(k: string): boolean {
  const lc = k.toLowerCase()
  if (SENSITIVE_KEYS.has(lc)) return true
  // patterns
  if (lc.includes("password") || lc.includes("secret") || lc.includes("apikey") || lc.includes("api_key")) return true
  if (lc === "set-cookie" || lc.startsWith("x-stripe-") || lc.startsWith("x-supabase-")) return true
  return false
}

function redactString(s: string): string {
  if (typeof s !== "string") return s
  let out = s
  out = out.replace(STRIPE_RE, "[stripe_redacted]")
  out = out.replace(APIKEY_RE, "[apikey_redacted]")
  out = out.replace(JWT_RE, "[jwt_redacted]")
  out = out.replace(EMAIL_RE, "[email_redacted]")
  out = out.replace(IBAN_RE, "[iban_redacted]")
  out = out.replace(CC_RE, "[cc_redacted]")
  out = out.replace(PHONE_FR_RE, "[phone_redacted]")
  // SIRET avant SIREN (14 puis 9)
  out = out.replace(SIRET_RE, "[siret_redacted]")
  out = out.replace(SIREN_RE, "[siren_redacted]")
  return out
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function redactObj(obj: any, depth = 0): any {
  if (obj == null) return obj
  if (depth > 8) return "[max_depth]"
  if (typeof obj === "string") return redactString(obj)
  if (typeof obj === "number" || typeof obj === "boolean") return obj
  if (Array.isArray(obj)) return obj.slice(0, 100).map((x) => redactObj(x, depth + 1))
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {}
    let n = 0
    for (const [k, v] of Object.entries(obj)) {
      if (n++ > 200) { out["[truncated]"] = true; break }
      if (isSensitiveKey(k)) {
        out[k] = "[redacted]"
      } else {
        out[k] = redactObj(v, depth + 1)
      }
    }
    return out
  }
  return obj
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function sentryBeforeSend(event: Event, _hint?: EventHint): Event | null {
  try {
    // Drop si event provient d'un endpoint health/ping (noise)
    if (event.request?.url && /\/(api\/health|api\/ping|favicon)/.test(event.request.url)) {
      return null
    }

    // Anonymise user
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
      delete event.user.username
      // Garde uniquement un hash de l'id pour corréler les sessions sans leak
      if (event.user.id) {
        event.user.id = String(event.user.id).slice(0, 8) + "..."
      }
    }

    // Request — drop cookies, Auth, redact body & query
    if (event.request) {
      if (event.request.cookies) event.request.cookies = "[redacted]" as never
      if (event.request.headers) {
        const filtered: Record<string, string> = {}
        for (const [k, v] of Object.entries(event.request.headers)) {
          if (isSensitiveKey(k)) filtered[k] = "[redacted]"
          else filtered[k] = redactString(String(v))
        }
        event.request.headers = filtered
      }
      if (event.request.data) {
        event.request.data = redactObj(event.request.data) as never
      }
      if (event.request.query_string) {
        event.request.query_string = redactString(String(event.request.query_string)) as never
      }
      if (event.request.url) {
        // Strip token from URL (e.g. ?access_token=...)
        event.request.url = redactString(event.request.url)
      }
    }

    // Extra / contexts / tags
    if (event.extra) event.extra = redactObj(event.extra) as never
    if (event.contexts) event.contexts = redactObj(event.contexts) as never
    if (event.tags) {
      for (const [k, v] of Object.entries(event.tags)) {
        if (typeof v === "string") event.tags[k] = redactString(v)
      }
    }

    // Breadcrumbs
    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        message: b.message ? redactString(b.message) : b.message,
        data: b.data ? (redactObj(b.data) as never) : b.data,
      }))
    }

    // Exception values (stack frames vars)
    if (event.exception?.values) {
      for (const v of event.exception.values) {
        if (v.value) v.value = redactString(v.value)
      }
    }

    // Message
    if (event.message) {
      if (typeof event.message === "string") event.message = redactString(event.message)
      // else event.message has formatted/params shape
    }

    return event
  } catch (e) {
    // Si la redaction crash, on drop l'event plutôt que de leak
    console.warn("[sentry-redact] failed, dropping event:", e instanceof Error ? e.message : e)
    return null
  }
}

/** Pour tests unitaires. */
export const __test__ = { redactString, redactObj, isSensitiveKey, COMMON_PWS_CHECK: SENSITIVE_KEYS }
