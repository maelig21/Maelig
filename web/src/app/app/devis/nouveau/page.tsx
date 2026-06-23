import { createSupabaseServerClient } from "@/lib/supabase/server"
import { DevisEditor } from "@/components/devis/devis-editor"

export const dynamic = "force-dynamic"

export default async function NouveauDevisPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles").select("org_id, role, permissions").eq("id", user!.id).maybeSingle()
  const orgId = profile?.org_id
  const perms = (profile?.permissions as Record<string, boolean>) ?? {}
  const canEditPrix = profile?.role === "owner" || profile?.role === "admin_dep" || perms.devis_prix === true
  const canCreate = profile?.role === "owner" || profile?.role === "admin_dep" || perms.devis_create === true

  const [{ data: org }, { data: articles }, { data: orgMetiers }, { data: clients }] = await Promise.all([
    supabase.from("orgs").select("taux_horaire_default, tva_default").eq("id", orgId!).maybeSingle(),
    supabase
      .from("articles")
      .select("id, nom, prix_unitaire_ht, unite, usage_count")
      .eq("org_id", orgId!)
      .eq("archived", false)
      .order("usage_count", { ascending: false })
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("orgs")
      .select("metiers")
      .eq("id", orgId!)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, nom, prenom, raison_sociale, email, telephone, adresse, ville, cp")
      .eq("org_id", orgId!)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  // Récupérer les articles du catalogue selon les métiers de l'org
  const metiers: string[] = orgMetiers?.metiers ?? []
  let catalogueArticles: { id: string; nom: string; prix_unitaire_ht: number | null; unite: string | null; usage_count: number }[] = []
  if (metiers.length > 0) {
    const { data: cat } = await supabase
      .from("articles_catalogue")
      .select("id, nom, unite")
      .in("metier", metiers)
      .order("usage_count", { ascending: false })
      .limit(300)
    // Articles du catalogue sans prix, uniquement si pas déjà dans les articles de l'org
    const orgNoms = new Set((articles ?? []).map((a) => a.nom.toLowerCase()))
    catalogueArticles = (cat ?? [])
      .filter((a) => !orgNoms.has(a.nom.toLowerCase()))
      .map((a) => ({ id: a.id, nom: a.nom, prix_unitaire_ht: null, unite: a.unite, usage_count: 0 }))
  }

  return (
    <DevisEditor
      canEditPrix={canEditPrix}
      orgDefaults={{
        taux_horaire: Number(org?.taux_horaire_default ?? 45),
        tva_default: Number(org?.tva_default ?? 20),
      }}
      knownArticles={[...(articles ?? []), ...catalogueArticles]}
      knownClients={clients ?? []}
    />
  )
}
