import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("org_id, role, permissions").eq("id", user.id).maybeSingle()
  const perms = (profile?.permissions as Record<string, boolean>) ?? {}
  const canEdit = profile?.role === "owner" || profile?.role === "admin_dep" || perms.catalogue_write === true

  if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { error } = await supabase
    .from("articles")
    .update({ archived: true })
    .eq("id", id)
    .eq("org_id", profile!.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
