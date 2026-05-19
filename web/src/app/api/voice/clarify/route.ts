import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { clarifyTranscript } from "@/lib/llm/clarify"

export const runtime = "nodejs"
export const maxDuration = 20

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const body = await req.json().catch(() => null) as { text?: string } | null
  const text = (body?.text ?? "").trim()
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 })

  // Hints from org catalog + recent clients
  const [{ data: articles }, { data: clients }] = await Promise.all([
    supabase
      .from("articles").select("nom")
      .eq("org_id", profile.org_id).eq("archived", false)
      .order("usage_count", { ascending: false }).limit(60),
    supabase
      .from("clients").select("nom, prenom, raison_sociale")
      .eq("org_id", profile.org_id).eq("archived", false).limit(30),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientLabels = (clients ?? []).map((c: any) => c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" "))

  try {
    const clarification = await clarifyTranscript(text, {
      knownArticles: (articles ?? []).map((a) => a.nom),
      knownClients: clientLabels,
    })
    return NextResponse.json({ ok: true, clarification })
  } catch (e) {
    return NextResponse.json({ error: "clarify_failed", detail: String(e) }, { status: 502 })
  }
}
