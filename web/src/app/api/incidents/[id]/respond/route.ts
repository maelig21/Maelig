import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { correctFR } from "@/lib/llm/dashscope"
import { translateMessage } from "@/lib/llm/translate"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase
    .from("profiles").select("org_id, role, langue_maternelle")
    .eq("id", user.id).maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const body = await req.json().catch(() => ({})) as {
    text?: string
    statut?: string
    set_response?: boolean
  }
  const text = (body.text ?? "").trim()
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 })

  // Récupère l'incident + destinataire (employé qui a créé) pour traduction
  const { data: incident } = await supabase
    .from("incidents")
    .select("id, org_id, sender_id, sender:profiles!incidents_sender_id_fkey(langue_maternelle)")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .maybeSingle()
  if (!incident) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const corrected = await correctFR(text).catch(() => text)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const senderLang = (incident.sender as any)?.langue_maternelle ?? "fr"
  const translations: Record<string, string> = { fr: corrected }
  if (senderLang && senderLang !== "fr") {
    try {
      translations[senderLang] = await translateMessage(corrected, "fr", senderLang)
    } catch {
      // continue without translation
    }
  }

  const admin = supabaseAdmin()
  await admin.from("incident_messages").insert({
    incident_id: id,
    sender_id: user.id,
    body_raw: text,
    body_corrected: corrected,
    translations,
  } as never)

  // Optionnel : update statut + reponse_patron
  const patch: Record<string, unknown> = {
    reponse_patron: corrected,
  }
  if (body.statut && ["ouvert","en_cours","resolu","escalade","ferme"].includes(body.statut)) {
    patch.statut = body.statut
    if (body.statut === "resolu" || body.statut === "ferme") {
      patch.resolved_at = new Date().toISOString()
      patch.resolved_by = user.id
    }
  }
  if (profile.role === "owner" || profile.role === "admin_dep") {
    await admin.from("incidents").update(patch).eq("id", id).eq("org_id", profile.org_id)
  }

  return NextResponse.json({ ok: true })
}
