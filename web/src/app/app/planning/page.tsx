import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PlanningClient } from "./client"

export const dynamic = "force-dynamic"

export default async function PlanningPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user!.id).maybeSingle()

  const [{ data: employes }, { data: devisSigne }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("org_id", profile!.org_id!)
      .in("role", ["owner", "slave", "admin_dep"])
      .order("prenom"),
    supabase
      .from("devis")
      .select("id, objet, clients(nom, prenom, raison_sociale)")
      .eq("org_id", profile!.org_id!)
      .in("statut", ["signe_non_paye", "facture_en_attente"])
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  return (
    <PlanningClient
      employes={employes ?? []}
      devisSigne={devisSigne ?? []}
      orgId={profile!.org_id!}
      currentUserId={user!.id}
    />
  )
}
