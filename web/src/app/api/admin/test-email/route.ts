import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { limitAdminEmail, tooManyRequests, clientIp } from "@/lib/ratelimit"
import { generateStrongPassword } from "@/lib/security/password"
import { logAuthEvent } from "@/lib/security/audit"
import { getAdminEmails } from "@/lib/config-reader"

// ADMIN_EMAILS est dans app_config['dep_electrique'].admin_emails
// NE PLUS hardcoder ici !

const Body = z.object({
  recipient: z.string().email(),
  template: z.enum(["test_transactional", "magic_link", "reset_password", "invite"]),
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const isAdmin = profile?.role === "admin_dep" || (await getAdminEmails()).includes((user.email || "").toLowerCase())
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  // P1-3 audit : rate limit 20/h par admin sur cet endpoint (prévention abuse)
  if (limitAdminEmail) {
    const rl = await limitAdminEmail.limit(user.id)
    if (!rl.success) return tooManyRequests({ success: false, remaining: rl.remaining, reset: rl.reset, limit: rl.limit })
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { recipient, template } = parsed.data
  const admin = supabaseAdmin()
  // P0-3 fix audit 2026-05-20 : NE PAS trust le header Origin
  // (un attaquant peut le forger pour injecter un magic link Supabase signé
  // qui redirige vers son domaine de phishing). Whitelist hardcoded.
  const ALLOWED_BASES = [
    "https://dep-electrique.vercel.app",
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[]
  const baseUrl = ALLOWED_BASES[0]

  let status: "sent" | "failed" = "sent"
  let errorMessage: string | null = null
  let responsePayload: Record<string, unknown> = {}

  try {
    if (template === "magic_link") {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: recipient,
        options: { redirectTo: `${baseUrl}/app` },
      })
      if (error) throw error
      responsePayload = { link: data.properties?.action_link ?? null }
    } else if (template === "reset_password") {
      const { error } = await admin.auth.resetPasswordForEmail(recipient, {
        redirectTo: `${baseUrl}/reinitialisation`,
      })
      if (error) throw error
    } else if (template === "invite") {
      const { error } = await admin.auth.admin.inviteUserByEmail(recipient, {
        redirectTo: `${baseUrl}/app`,
      })
      if (error) throw error
    } else {
      // test_transactional : on simule un signup OTP qui déclenche le SMTP
      // P1 audit 2026-05-20 — generateStrongPassword (24 chars, charset large,
      // crypto.getRandomValues) au lieu de crypto.randomUUID() qui suit un
      // pattern prévisible (8-4-4-4-12 hex).
      const { error } = await admin.auth.admin.generateLink({
        type: "signup",
        email: recipient,
        password: generateStrongPassword(24),
        options: { redirectTo: `${baseUrl}/app` },
      })
      // Tolère "user already registered" : on tombe sur reset à la place
      if (error && /already (registered|exists)/i.test(error.message)) {
        const { error: e2 } = await admin.auth.resetPasswordForEmail(recipient, {
          redirectTo: `${baseUrl}/reinitialisation`,
        })
        if (e2) throw e2
        responsePayload = { note: "user existait déjà → reset envoyé à la place" }
      } else if (error) {
        throw error
      }
    }
  } catch (e) {
    status = "failed"
    errorMessage = e instanceof Error ? e.message : String(e)
  }

  await admin.from("email_test_log").insert({
    sender_user_id: user.id,
    recipient_email: recipient,
    template,
    provider: "supabase_smtp",
    status,
    error_message: errorMessage,
    request_payload: { template, recipient },
    response_payload: responsePayload,
  })

  // P1 audit 2026-05-20 — Trace dans auth_events (RGPD: admin action sur user)
  await logAuthEvent("admin_action", {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? null,
    userId: user.id,
    email: user.email,
    metadata: { admin_action: "test-email", template, recipient_masked: recipient.slice(0, 2) + "***", status },
  })

  if (status === "failed") {
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
