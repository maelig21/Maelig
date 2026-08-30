/**
 * Client Super PDP — Plateforme agréée pour la facturation électronique
 * conforme à la réforme française (format UBL, réseau Peppol).
 *
 * Basé sur le script officiel : https://github.com/superpdp/examples
 * Documentation : https://www.superpdp.tech/documentation/2
 */

const BASE_URL = process.env.SUPERPDP_ENDPOINT ?? "https://api.superpdp.tech"

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Récupère un token d'accès OAuth2 (client_credentials), avec cache en
 * mémoire pour éviter de redemander un token à chaque appel.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token
  }

  const clientId = process.env.SUPERPDP_CLIENT_ID
  const clientSecret = process.env.SUPERPDP_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("SUPERPDP_CLIENT_ID / SUPERPDP_CLIENT_SECRET manquants")
  }

  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (res.status !== 200) {
    const detail = await res.text()
    throw new Error(`[superpdp] token request failed: ${res.status} ${detail.slice(0, 300)}`)
  }

  const data = await res.json() as { access_token: string; expires_in?: number }
  cachedToken = {
    token: data.access_token,
    // expires_in n'est pas garanti dans la réponse d'après le script officiel — fallback 55 min
    expiresAt: Date.now() + (data.expires_in ?? 3300) * 1000,
  }
  return cachedToken.token
}

/** Vérifie l'entreprise associée aux identifiants configurés. */
export async function getMyCompany(): Promise<{ formal_name: string; [k: string]: unknown }> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/v1.beta/companies/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status !== 200) {
    throw new Error(`[superpdp] companies/me failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Transmet une facture à Super PDP pour distribution via le réseau Peppol.
 * Super PDP détecte automatiquement le format envoyé (Factur-X, CII, UBL)
 * et le convertit en interne vers sa représentation EN16931.
 *
 * Le corps de la requête est le contenu brut du document, pas un FormData
 * (confirmé par le script officiel superpdp/examples).
 */
export async function submitInvoice(fileBuffer: Buffer, contentType = "application/pdf"): Promise<{ id: string | number; [k: string]: unknown }> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v1.beta/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(fileBuffer),
  })

  if (res.status !== 200) {
    const detail = await res.text()
    throw new Error(`[superpdp] invoice submission failed: ${res.status} ${detail.slice(0, 300)}`)
  }

  return res.json()
}

/** Vérifie le statut de transmission d'une facture déjà envoyée. */
export async function getInvoiceStatus(invoiceId: string | number): Promise<{ id: string | number; en_invoice?: unknown; [k: string]: unknown }> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v1.beta/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status !== 200) {
    throw new Error(`[superpdp] status check failed: ${res.status}`)
  }

  return res.json()
}

/** Envoie un événement de cycle de vie (ex: "Encaissée" = fr:212). */
export async function sendInvoiceEvent(invoiceId: string | number, statusCode: string): Promise<void> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v1.beta/invoice_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invoice_id: invoiceId, status_code: statusCode }),
  })

  if (!res.ok) {
    throw new Error(`[superpdp] invoice event failed: ${res.status}`)
  }
}
