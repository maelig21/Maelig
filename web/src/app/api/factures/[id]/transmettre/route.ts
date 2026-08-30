/**
 * Transmission d'une facture à la plateforme agréée Super PDP (conformité
 * réforme facturation électronique). N'agit que si l'entreprise a activé
 * l'option dans ses paramètres (facturation_electronique_active).
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { submitInvoice } from "@/lib/superpdp/client"

export const runtime = "nodejs"
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const { data: org } = await supabase
    .from("orgs")
    .select("facturation_electronique_active")
    .eq("id", profile.org_id)
    .maybeSingle()

  if (!org?.facturation_electronique_active) {
    return NextResponse.json({ error: "not_enabled", detail: "Activez la facturation électronique dans les paramètres société." }, { status: 400 })
  }

  const { data: facture } = await supabase
    .from("factures")
    .select("id, numero, superpdp_invoice_id")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .maybeSingle()

  if (!facture) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (facture.superpdp_invoice_id) {
    return NextResponse.json({ ok: true, already: true, superpdp_id: facture.superpdp_invoice_id })
  }

  try {
    // Réutilise la génération Factur-X déjà fonctionnelle
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const pdfRes = await fetch(`${baseUrl}/api/factures/${id}/facturx`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    })
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "facturx_generation_failed" }, { status: 500 })
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    const result = await submitInvoice(pdfBuffer, "application/pdf")

    await supabase
      .from("factures")
      .update({ superpdp_invoice_id: String(result.id), superpdp_status: "envoyee" })
      .eq("id", id)

    return NextResponse.json({ ok: true, superpdp_id: result.id })
  } catch (e) {
    console.error("[superpdp] transmission failed:", e)
    return NextResponse.json({ error: "transmission_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
