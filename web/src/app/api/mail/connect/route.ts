/**
 * Gmail OAuth (Supabase Auth Google provider).
 * On déclenche un signin avec scope additionnel `gmail.send` afin d'obtenir
 * un access_token utilisable pour envoyer depuis la boîte du patron.
 *
 * Pré-requis : Google OAuth doit être configuré dans Supabase Dashboard.
 * → Auth Providers → Google → enable + client_id/secret + scopes:
 *   `openid email profile https://www.googleapis.com/auth/gmail.send`
 */
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/api/mail/callback`,
      scopes: "https://www.googleapis.com/auth/gmail.send openid email profile",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.url })
}
