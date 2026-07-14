import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend"

export const runtime = "nodejs"
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return timingSafeEqual(ab, bb)
}

export async function GET(req: Request) {
  if (!CRON_SECRET) return NextResponse.json({ error: "service unavailable" }, { status: 503 })
  const auth = req.headers.get("authorization") ?? ""
  if (!timingSafeStringEqual(auth, `Bearer ${CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dep-pro.fr"

  // Récupérer les devis envoyés il y a plus de 3 jours et non signés
  const ilYa3Jours = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: devis } = await admin
    .from("devis")
    .select(`
      id, objet, total_ttc, date_envoi_email,
      clients(nom, prenom, raison_sociale, email),
      orgs(nom, email, relance_hebdo_jours)
    `)
    .eq("statut", "en_attente_validation")
    .not("date_envoi_email", "is", null)
    .lte("date_envoi_email", ilYa3Jours)

  let sent = 0
  const errors: string[] = []

  for (const d of devis ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (d.clients as any) ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (d.orgs as any) ?? {}
    if (!client.email) continue

    const clientName = client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || "Client"
    const signUrl = `${baseUrl}/signer/${d.id}`

    const html = `
<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #e4e4e7;">
  <div style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">⚡ DEP</div>
  <div style="color: #71717a; font-size: 14px; margin-bottom: 24px;">Devis et gestion d'entreprise</div>
  <h2 style="color: #18181b; font-size: 22px; margin-bottom: 16px;">Rappel : votre devis attend votre signature</h2>
  <p style="color: #3f3f46; line-height: 1.6;">Bonjour ${clientName},</p>
  <p style="color: #3f3f46; line-height: 1.6;">Nous vous rappelons que votre devis <strong>${d.objet ?? "sans objet"}</strong> est en attente de votre signature.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${signUrl}" style="background: #f5c518; color: #000000; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-size: 16px;">
      Consulter et signer le devis →
    </a>
  </div>
  <p style="color: #71717a; font-size: 13px;">Si vous avez des questions, répondez simplement à cet email.</p>
  <div style="border-top: 1px solid #e4e4e7; margin-top: 24px; padding-top: 16px; color: #71717a; font-size: 12px;">
    ${org.nom ?? "DEP"} · dep-pro.fr
  </div>
</div>`

    try {
      await sendEmail({
        to: client.email,
        subject: `Rappel : votre devis attend votre signature`,
        html,
        text: `Bonjour ${clientName},\n\nVotre devis ${d.objet ?? ""} attend votre signature.\n\nSignez ici : ${signUrl}`,
        replyTo: org.email || undefined,
      })
      sent++
    } catch (e) {
      errors.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, sent, errors_count: errors.length, errors })
}
