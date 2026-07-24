import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppearanceEditor } from "./client"

export const dynamic = "force-dynamic"

export default async function Page() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/connexion")

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  const isOwner = profile?.role === "owner" || profile?.role === "admin_dep"
  if (!isOwner) redirect("/app/parametres")

  const { data: org } = await supabase.from("orgs").select("nom, logo_url, couleur_principale, police, devis_settings").eq("id", profile!.org_id!).maybeSingle()

  return (
    <AppearanceEditor
      orgId={profile!.org_id!}
      orgNom={org?.nom ?? "Mon Entreprise"}
      orgLogoUrl={org?.logo_url ?? null}
      initialSettings={{
        couleur: org?.couleur_principale ?? "#1e40af",
        police: org?.police ?? "Inter",
        ...(org?.devis_settings as object ?? {}),
      }}
    />
  )
}
