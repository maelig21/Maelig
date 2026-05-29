/**
 * Resend wrapper — emails transactionnels DEP.
 * Sans dépendance officielle pour limiter le bundle.
 */
const RESEND_URL = "https://api.resend.com/emails"
const KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM || "DEP <noreply@dep-electrique.fr>"
const FALLBACK_FROM = "DEP <onboarding@resend.dev>"

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string /* base64 */ }>
}

async function doSend(input: SendEmailInput, from: string, html: string) {
  return fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html,
      text: input.text,
      reply_to: input.replyTo,
      attachments: input.attachments,
    }),
  })
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  if (!KEY) throw new Error("RESEND_API_KEY missing")

  let res = await doSend(input, FROM, input.html)

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    let parsed: { message?: string; name?: string } | null = null
    try { parsed = JSON.parse(detail) } catch { /* keep raw text */ }

    // ── Fallback domaine non vérifié ──
    if (res.status === 403 && parsed?.message?.includes("domain is not verified")) {
      console.warn(`[resend] Domaine non vérifié — tentative fallback via ${FALLBACK_FROM}`)

      const warningBanner = `<div style="background:#ffd500;color:#000;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;line-height:1.5">
        ⚠️ Vous recevez cet email via le service temporaire de DEP — le domaine officiel sera bientôt actif.
      </div>`
      const fallbackHtml = warningBanner + input.html
      const fbRes = await doSend(input, FALLBACK_FROM, fallbackHtml)

      if (fbRes.ok) {
        console.warn(`[resend] Email envoyé via fallback ${FALLBACK_FROM}`)
        const data = await fbRes.json() as { id: string }
        return data
      }

      // Fallback aussi en échec
      const fbDetail = await fbRes.text().catch(() => "")
      let fbParsed: { message?: string } | null = null
      try { fbParsed = JSON.parse(fbDetail) } catch {}
      throw new Error(
        `[resend] Domaine non vérifié sur Resend. Ajoutez et vérifiez le domaine dep-electrique.fr sur https://resend.com/domains. ` +
        `Le fallback via ${FALLBACK_FROM} a également échoué (${fbRes.status}): ${fbParsed?.message || fbDetail.slice(0, 200)}`
      )
    }

    if (res.status === 401) {
      throw new Error(`[resend] Clé API invalide — vérifiez RESEND_API_KEY`)
    }
    throw new Error(`[resend] ${res.status} ${parsed?.message || detail.slice(0, 200)}`)
  }
  const data = await res.json() as { id: string }
  return data
}
