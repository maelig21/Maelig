import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "owner" && profile?.role !== "admin_dep") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { settings } = await req.json()
  const { couleur, police, ...devis_settings } = settings

  const { error } = await supabase
    .from("orgs")
    .update({
      couleur_principale: couleur,
      police,
      devis_settings,
    })
    .eq("id", profile!.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
