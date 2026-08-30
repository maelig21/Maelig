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

  const body = await req.json() as {
    client_id: string
    client_secret?: string
    electronic_address?: string
    active: boolean
  }

  if (!body.client_id?.trim()) {
    return NextResponse.json({ error: "client_id_required" }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    superpdp_client_id: body.client_id.trim(),
    facturation_electronique_active: body.active,
  }
  // Ne met à jour le secret que s'il est fourni (permet de garder l'existant)
  if (body.client_secret) {
    update.superpdp_client_secret = body.client_secret.trim()
  }
  if (body.electronic_address) {
    update.superpdp_electronic_address = body.electronic_address.trim()
  }

  const { error } = await supabase
    .from("orgs")
    .update(update)
    .eq("id", profile!.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
