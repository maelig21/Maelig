/**
 * Resend wrapper — emails transactionnels DEP.
 * Sans dépendance officielle pour limiter le bundle.
 */
const RESEND_URL = "https://api.resend.com/emails"
const KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM || "DEP <noreply@dep-electrique.fr>"

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string /* base64 */ }>
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  if (!KEY) throw new Error("RESEND_API_KEY missing")
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
      attachments: input.attachments,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`[resend] ${res.status} ${detail.slice(0, 200)}`)
  }
  const data = await res.json() as { id: string }
  return data
}
