import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  if (me?.role !== "owner" && me?.role !== "admin_dep") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { permissions } = await req.json()

  const { error } = await supabase
    .from("profiles")
    .update({ permissions })
    .eq("id", id)
    .eq("org_id", me.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
