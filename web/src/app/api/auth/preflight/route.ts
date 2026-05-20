import { NextResponse } from "next/server"
import { z } from "zod"
import { limitAuth, limitPasswordReset, clientIp, tooManyRequests } from "@/lib/ratelimit"
import { isAuthLocked, logAuthEvent } from "@/lib/security/audit"

// P1-1 audit 2026-05-20 — pré-flight rate limit appelé AVANT chaque tentative
// login/signup/password-reset depuis le browser. Protège contre credential stuffing.
// Combine 3 couches :
//   1) Upstash Redis sliding window (5/15min IP)
//   2) Postgres lockout persistant (5 fails => 15min lock, table auth_lockouts)
//   3) Audit log (auth_events) — RGPD compliance

const Body = z.object({
  action: z.enum(["login", "signup", "password_reset"]),
  email: z.string().email().max(255).optional(),
})

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null
  const { action, email } = parsed.data

  // 1) Lockout persistant (Postgres) — bypass si Upstash absent
  if (await isAuthLocked(ip, email)) {
    await logAuthEvent("rate_limit_block", { ip, userAgent: ua, email, metadata: { action, source: "lockout" } })
    return NextResponse.json({
      error: "auth_locked",
      message: "Trop de tentatives. Compte verrouillé 15 min.",
    }, { status: 423 })
  }

  // 2) Rate limit Upstash
  const limit = action === "password_reset" ? limitPasswordReset : limitAuth
  if (limit) {
    // Clé combinée IP+email pour éviter qu'un attacker change d'email à chaque requête
    const key = email ? `${ip}|${email.toLowerCase()}` : ip
    const result = await limit.limit(key)
    if (!result.success) {
      await logAuthEvent("rate_limit_block", { ip, userAgent: ua, email, metadata: { action, source: "upstash" } })
      return tooManyRequests({
        success: false,
        remaining: result.remaining,
        reset: result.reset,
        limit: result.limit,
      })
    }
    return NextResponse.json({ ok: true, remaining: result.remaining })
  }

  return NextResponse.json({ ok: true, rate_limited: false, note: "rate-limit disabled (Upstash missing)" })
}
