import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/app/sidebar"
import { MobileTopbar } from "@/components/app/topbar"
import { BottomNav } from "@/components/app/bottom-nav"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/connexion")

  // OAuth (Google/Apple) → email déjà vérifié par le provider.
  // Email/password → bloquer tant que email_confirmed_at est null.
  const provider = (user.app_metadata?.provider as string) ?? "email"
  if (provider === "email" && !user.email_confirmed_at) {
    redirect("/verifier-email")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, org_id")
    .eq("id", user.id)
    .maybeSingle()

  const { data: org } = profile?.org_id
    ? await supabase.from("orgs").select("nom, subscription_status, trial_ends_at, logo_url").eq("id", profile.org_id).maybeSingle()
    : { data: null }

  // Compteurs pour les notifications
  const counts = { aValider: 0, incidents: 0 }
  if (profile?.org_id && (profile?.role === "owner" || profile?.role === "admin_dep")) {
    const now = new Date()
    const hier = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const [{ count: aValider }, { count: incidents }, { count: planning }] = await Promise.all([
      supabase.from("devis").select("*", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("statut", "en_attente_validation"),
      supabase.from("incidents").select("*", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("statut", "ouvert"),
      supabase.from("planning").select("*", { count: "exact", head: true }).eq("org_id", profile.org_id).gte("created_at", hier),
    ])
    counts.aValider = aValider ?? 0
    counts.incidents = incidents ?? 0
    counts.planning = planning ?? 0
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} org={org} counts={counts} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopbar />
        <main className="flex-1 overflow-x-hidden pb-20 lg:pb-0">{children}</main>
        <BottomNav />
      </div>
    </div>
  )
}
