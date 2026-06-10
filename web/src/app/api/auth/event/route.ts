/**
 * POST /api/auth/event
 * Client browser appelle ce endpoint après chaque tentative login/signup/reset
 * pour journaliser l'événement (RGPD + brute force tracking). Le secret du
 * compte (mot de passe) n'est JAMAIS envoyé ici.
 *
 * Endpoints :
 *   - login_ok       — auth réussie, on clear le lockout
 *   - login_fail     — auth échouée, on incrémente le lockout
 *   - signup         — création compte (réussite ou échec)
 *   - reset_request  — demande de reset password
 *   - reset_ok       — reset effectué
 *   - logout
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp } from "@/lib/ratelimit"
import { logAuthEvent, recordAuthFail, clearAuthLockout, type AuthEvent } from "@/lib/security/audit"

const Body = z.object({
  event: z.enum([
    "login_ok", "login_fail", "signup", "signup_fail", "logout",
    "reset_request", "reset_ok", "password_change",
  ]),
  email: z.string().email().max(255).optional(),
  user_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null
  const { event, email, user_id, metadata } = parsed.data

  // Lockout tracking sur les events critiques
  if (event === "login_fail" || event === "signup_fail") {
    const r = await recordAuthFail(ip, email)
    await logAuthEvent(event as AuthEvent, {
      ip, userAgent: ua, email, userId: user_id,
      metadata: { ...metadata, fails: r.fails, locked: r.locked },
    })
    return NextResponse.json({ ok: true, locked: r.locked, fails: r.fails })
  }

  if (event === "login_ok") {
    await clearAuthLockout(ip, email)
  }

  await logAuthEvent(event as AuthEvent, { ip, userAgent: ua, email, userId: user_id, metadata })
  return NextResponse.json({ ok: true })
}
