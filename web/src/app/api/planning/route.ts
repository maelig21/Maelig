import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const debut = req.nextUrl.searchParams.get("debut")
  const fin = req.nextUrl.searchParams.get("fin")

  const { data: entries } = await supabase
    .from("planning")
    .select("*")
    .eq("org_id", profile!.org_id!)
    .gte("date", debut!)
    .lte("date", fin!)
    .order("heure_debut")

  return NextResponse.json({ entries: entries ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const body = await req.json()
  const { error, data } = await supabase
    .from("planning")
    .insert({
      org_id: profile!.org_id!,
      employe_id: body.employe_id,
      devis_id: body.devis_id || null,
      date: body.date,
      heure_debut: body.heure_debut || null,
      heure_fin: body.heure_fin || null,
      titre: body.titre,
      notes: body.notes || null,
      couleur: body.couleur ?? "blue",
      statut: body.statut ?? "planifie",
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, entry: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const body = await req.json()
  const { error } = await supabase
    .from("planning")
    .update({
      devis_id: body.devis_id || null,
      date: body.date,
      heure_debut: body.heure_debut || null,
      heure_fin: body.heure_fin || null,
      titre: body.titre,
      notes: body.notes || null,
      couleur: body.couleur ?? "blue",
      statut: body.statut ?? "planifie",
    })
    .eq("id", body.id)
    .eq("org_id", profile!.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const id = req.nextUrl.searchParams.get("id")
  const { error } = await supabase
    .from("planning")
    .delete()
    .eq("id", id!)
    .eq("org_id", profile!.org_id!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
