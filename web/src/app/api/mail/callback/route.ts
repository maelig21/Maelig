import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  if (!code) return NextResponse.redirect(new URL("/app/parametres?mail_error=missing_code", req.url))

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(new URL(`/app/parametres?mail_error=${encodeURIComponent(error?.message ?? "session")}`, req.url))
  }

  // Récupère les tokens Google depuis la session
  const session = data.session
  const providerToken = session?.provider_token
  const providerRefresh = session?.provider_refresh_token
  if (!providerToken) {
    return NextResponse.redirect(new URL("/app/parametres?mail_error=no_token", req.url))
  }

  const { data: profile } = await supabase.from("profiles").select("org_id, email").eq("id", data.user.id).maybeSingle()
  if (!profile?.org_id) return NextResponse.redirect(new URL("/app/parametres?mail_error=no_org", req.url))

  await supabaseAdmin().from("mail_connections").upsert({
    org_id: profile.org_id,
    user_id: data.user.id,
    provider: "google",
    email: profile.email || data.user.email!,
    access_token: providerToken,
    refresh_token: providerRefresh ?? null,
    scopes: "gmail.send",
    is_default: true,
  } as never, { onConflict: "org_id,provider,email" })

  return NextResponse.redirect(new URL("/app/parametres?mail_connected=1", req.url))
}
