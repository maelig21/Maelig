import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
    if (!profile?.org_id || (profile.role !== "owner" && profile.role !== "admin_dep")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const form = await req.formData()
    const file = form.get("logo") as File
    if (!file || file.size === 0) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 })
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Doit être une image" }, { status: 400 })
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Max 2 Mo" }, { status: 400 })

    // Convert to base64 data URL
    const buf = Buffer.from(await file.arrayBuffer())
    const base64 = buf.toString("base64")
    const dataUrl = `data:${file.type};base64,${base64}`

    // Store directly in orgs table (no Storage API needed)
    const { error: upErr } = await supabase
      .from("orgs")
      .update({ logo_url: dataUrl, logo_base64: dataUrl })
      .eq("id", profile.org_id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    revalidatePath("/app/parametres/logo")
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur" }, { status: 500 })
  }
}
