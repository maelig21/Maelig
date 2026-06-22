import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: devis } = await admin
    .from("devis")
    .select("statut, clients(email)")
    .eq("id", id)
    .maybeSingle()

  if (!devis) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (devis.statut === "signe_non_paye" || devis.statut === "facture_en_attente" || devis.statut === "facture_payee") {
    return NextResponse.json({ ok: true, already: true })
  }

  // Capturer IP et email pour preuve de signature
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "inconnue"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientEmail = (devis.clients as any)?.email ?? null

  const { error } = await admin
    .from("devis")
    .update({
      statut: "signe_non_paye",
      signe_le: new Date().toISOString(),
      signe_ip: ip,
      signe_email: clientEmail,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
