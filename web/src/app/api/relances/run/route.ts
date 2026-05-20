/**
 * Cron quotidien (9h Paris via vercel.json crons).
 * Envoie les relances dues :
 *  - hebdo pendant les 30 premiers jours après échéance
 *  - quotidienne ensuite jusqu'au paiement
 *  - finale après 60 jours (1× puis stop pour basculer en contentieux)
 *
 * Sécurité : authentifié par CRON_SECRET (header Authorization: Bearer …).
 * Vercel ajoute automatiquement ce header pour les crons configurés.
 */
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend"
import { relanceTemplate } from "@/lib/email/templates"

export const runtime = "nodejs"
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: Request) {
  // P0-2 fix audit 2026-05-20 : fail-closed si CRON_SECRET absent.
  // Sans ça, n'importe qui pouvait `curl /api/relances/run` → spam Resend.
  if (!CRON_SECRET) {
    console.error("CRON_SECRET missing in env — refusing to run relances")
    return NextResponse.json({ error: "service unavailable" }, { status: 503 })
  }
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data: factures, error } = await admin
    .from("factures")
    .select(`
      id, org_id, numero, total_ttc, montant_paye, date_emission, date_echeance,
      relances_count, last_relance_at, statut,
      clients ( nom, prenom, raison_sociale, email ),
      orgs ( nom, email, relance_hebdo_jours, relance_quotidienne_after )
    `)
    .in("statut", ["en_attente", "partielle"])
    .lte("date_echeance", today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  const errors: string[] = []

  for (const f of factures ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (f.clients as any) ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (f.orgs as any) ?? {}
    if (!client.email) continue

    const dueDate = new Date(f.date_echeance ?? f.date_emission)
    const daysLate = Math.floor((Date.now() - dueDate.getTime()) / 86_400_000)
    if (daysLate < 0) continue

    const lastRelance = f.last_relance_at ? new Date(f.last_relance_at) : null
    const daysSinceLast = lastRelance ? Math.floor((Date.now() - lastRelance.getTime()) / 86_400_000) : Infinity

    let intensity: "hebdo" | "quotidienne" | "finale" | null = null
    if (daysLate >= 60 && f.relances_count < 12) {
      intensity = "finale"
    } else if (daysLate >= (org.relance_quotidienne_after ?? 30)) {
      if (daysSinceLast >= 1) intensity = "quotidienne"
    } else {
      if (daysSinceLast >= (org.relance_hebdo_jours ?? 7)) intensity = "hebdo"
    }

    if (!intensity) continue

    const reste = Number(f.total_ttc) - Number(f.montant_paye)
    const tpl = relanceTemplate({
      clientName: client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" "),
      numero: f.numero ?? "—",
      totalTtc: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(f.total_ttc)),
      reste: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(reste),
      dateEcheance: new Intl.DateTimeFormat("fr-FR").format(dueDate),
      joursRetard: daysLate,
      payUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/factures/${f.id}/payer`,
      patron: org.nom ?? "",
      patronEntreprise: org.nom ?? "",
      intensity,
    })

    try {
      await sendEmail({ to: client.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      await admin.from("relances").insert({
        facture_id: f.id,
        type: intensity,
        email_to: client.email,
        sujet: tpl.subject,
        body_html: tpl.html,
        status: "sent",
      })
      await admin.from("factures").update({
        relances_count: f.relances_count + 1,
        last_relance_at: new Date().toISOString(),
      }).eq("id", f.id)
      sent++
    } catch (e) {
      errors.push(`${f.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, sent, errors_count: errors.length, errors })
}
