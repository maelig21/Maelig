import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MobileHome } from "./client"

export const dynamic = "force-dynamic"

export default async function MobilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/connexion")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, full_name, permissions")
    .eq("id", user.id)
    .maybeSingle()

  const perms = (profile?.permissions as Record<string, boolean>) ?? {}
  const isOwner = profile?.role === "owner" || profile?.role === "admin_dep"

  return (
    <MobileHome
      userName={profile?.full_name ?? ""}
      isOwner={isOwner}
      permissions={perms}
    />
  )
}
