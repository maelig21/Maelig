/**
 * Client Super PDP — Plateforme agréée pour la facturation électronique
 * conforme à la réforme française (Factur-X, réseau Peppol).
 *
 * Chaque entreprise cliente DEP possède ses propres identifiants OAuth
 * (client_id/client_secret) obtenus via son propre compte Super PDP —
 * voir /app/parametres/facturation-electronique pour le guide.
 *
 * Basé sur le script officiel : https://github.com/superpdp/examples
 */

const BASE_URL = process.env.SUPERPDP_ENDPOINT ?? "https://api.superpdp.tech"

// Cache de tokens en mémoire, par client_id (une entreprise = un token)
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache.get(clientId)
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token
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
  tokenCache.set(clientId, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3300) * 1000,
  })
  return data.access_token
}

/** Vérifie l'entreprise associée aux identifiants fournis. */
export async function getMyCompany(clientId: string, clientSecret: string): Promise<{ formal_name: string; [k: string]: unknown }> {
  const token = await getAccessToken(clientId, clientSecret)
  const res = await fetch(`${BASE_URL}/v1.beta/companies/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status !== 200) {
    throw new Error(`[superpdp] companies/me failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Transmet une facture (PDF Factur-X ou XML UBL/CII — détection automatique
 * par Super PDP) pour distribution via le réseau Peppol.
 */
export async function submitInvoice(
  clientId: string,
  clientSecret: string,
  fileBuffer: Buffer,
  contentType = "application/pdf",
): Promise<{ id: string | number; [k: string]: unknown }> {
  const token = await getAccessToken(clientId, clientSecret)

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
export async function getInvoiceStatus(
  clientId: string,
  clientSecret: string,
  invoiceId: string | number,
): Promise<{ id: string | number; en_invoice?: unknown; [k: string]: unknown }> {
  const token = await getAccessToken(clientId, clientSecret)

  const res = await fetch(`${BASE_URL}/v1.beta/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status !== 200) {
    throw new Error(`[superpdp] status check failed: ${res.status}`)
  }

  return res.json()
}
