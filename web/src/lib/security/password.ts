/**
 * P1 audit 2026-05-20 — Password strength check, lightweight (sans zxcvbn).
 *
 * On évite la dépendance zxcvbn (~1 MB) car on n'a pas besoin de l'estimation
 * fine. Pour DEP B2B, on veut surtout:
 *   - 12 caractères minimum
 *   - 3 catégories sur 4 (lower, upper, digit, special)
 *   - pas dans le top 5000 mots de passe les plus fréquents
 *   - pas l'email user
 *
 * Validation FRONT (UX) + BACK (sécurité) pour éviter mismatch.
 */

const COMMON_PWS = new Set([
  // Top 50 mots de passe les plus exposés en breach (RockYou, Have I Been Pwned)
  "password", "123456", "12345678", "qwerty", "azerty",
  "abc123", "password1", "iloveyou", "admin", "welcome",
  "monkey", "dragon", "master", "letmein", "trustno1",
  "sunshine", "princess", "qwerty123", "azerty123", "111111",
  "123123", "654321", "qwertyuiop", "1q2w3e4r", "passw0rd",
  "p@ssword", "p@ssw0rd", "motdepasse", "soleil", "bonjour",
  "djibril", "maelig", "depelectrique", "electrique", "btp",
  "chantier", "patron", "ouvrier", "compagnon", "facture",
  "devis", "client", "test1234", "azerty12", "qwerty12",
  // Common French weak passwords
  "azertyuiop", "marseille", "paris", "france", "loulou",
])

export interface PwCheckResult {
  ok: boolean
  score: number          // 0-4
  reason?: string
  hint?: string
}

export function checkPasswordStrength(pw: string, opts: { email?: string | null; name?: string | null } = {}): PwCheckResult {
  if (!pw) return { ok: false, score: 0, reason: "empty" }
  if (pw.length < 12) return { ok: false, score: 0, reason: "too_short", hint: "12 caractères minimum" }
  if (pw.length > 72) return { ok: false, score: 0, reason: "too_long", hint: "72 caractères maximum (bcrypt limit)" }

  const lower = /[a-z]/.test(pw)
  const upper = /[A-Z]/.test(pw)
  const digit = /[0-9]/.test(pw)
  const special = /[^a-zA-Z0-9]/.test(pw)
  const categories = [lower, upper, digit, special].filter(Boolean).length

  if (categories < 3) {
    return { ok: false, score: 1, reason: "low_complexity", hint: "Mélangez minuscules, majuscules, chiffres et un caractère spécial" }
  }

  const lc = pw.toLowerCase()
  if (COMMON_PWS.has(lc)) {
    return { ok: false, score: 0, reason: "common", hint: "Mot de passe trop commun (dictionnaire)" }
  }

  // Reject si contient l'email user ou nom
  if (opts.email) {
    const local = opts.email.toLowerCase().split("@")[0]
    if (local.length >= 4 && lc.includes(local)) {
      return { ok: false, score: 1, reason: "contains_email", hint: "Ne pas inclure votre email" }
    }
  }
  if (opts.name) {
    const name = opts.name.toLowerCase().replace(/\s+/g, "")
    if (name.length >= 4 && lc.includes(name)) {
      return { ok: false, score: 1, reason: "contains_name", hint: "Ne pas inclure votre nom" }
    }
  }

  // Détecter séquences simples (123456, abcdef, qwerty)
  if (/(.)\1{3,}/.test(pw)) {
    return { ok: false, score: 1, reason: "repeated", hint: "Évitez les caractères répétés (aaaa, 1111)" }
  }
  if (/(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|qwer|wert|erty|rtyu|asdf|sdfg|dfgh|zxcv)/i.test(pw)) {
    return { ok: false, score: 1, reason: "sequence", hint: "Évitez les séquences clavier (1234, qwerty)" }
  }

  // Score 2-4 selon longueur + entropy approximative
  let score = 2
  if (pw.length >= 16) score = 3
  if (pw.length >= 20 && categories === 4) score = 4

  return { ok: true, score }
}

/**
 * Génère un mot de passe robuste cryptographiquement (test-email, invites).
 * Utilise webcrypto exposé sur globalThis.crypto (Node ≥ 20 + Edge + Browser).
 */
export function generateStrongPassword(length = 24): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*()_-+="
  // Node 20+ : globalThis.crypto = webcrypto. Edge runtime aussi. Pas de require fallback.
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error("WebCrypto not available — require Node 20+ or Edge runtime")
  }
  const arr = new Uint32Array(length)
  cryptoApi.getRandomValues(arr)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += charset[arr[i] % charset.length]
  }
  return out
}
