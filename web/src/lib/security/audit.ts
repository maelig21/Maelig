/**
 * P1 audit 2026-05-20 — Journal d'événements auth (RGPD + B2B compliance).
 * Écrit dans auth_events via service_role. Toutes les fonctions sont
 * fail-soft : si l'insert échoue, on log mais on ne casse pas le flux user.
 */
import { createHash } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type AuthEvent =
  | "login_ok"
  | "login_fail"
  | "signup"
  | "signup_fail"
  | "logout"
  | "reset_request"
  | "reset_ok"
  | "password_change"
  | "role_change"
  | "mfa_enroll"
  | "mfa_verify"
  | "admin_action"
  | "data_export"
  | "rate_limit_block"

export interface AuditCtx {
  ip?: string | null
  userAgent?: string | null
  userId?: string | null
  email?: string | null
  orgId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * SHA256(lower(email)) — utilisé pour brute-force lockout sans leak.
 * Note : cette fonction n'est PAS utilisée pour comparer un secret en
 * constant-time. Elle hash une string user pour le stockage. Le early
 * return sur null/empty est intentionnel (perf + null safety).
 */
export function emailHash(email: string | null | undefined): string | null {
  if (!email) return null
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex")
}

/** Masque un email pour audit display : `je***@example.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf("@")
  if (at <= 0) return "[invalid]"
  return email.slice(0, 2) + "***" + email.slice(at)
}

/** Log audit. Fail-soft : never throws. */
export async function logAuthEvent(event: AuthEvent, ctx: AuditCtx = {}): Promise<void> {
  try {
    const admin = supabaseAdmin()
    await admin.from("auth_events").insert({
      user_id: ctx.userId ?? null,
      email: maskEmail(ctx.email),
      event,
      ip: ctx.ip ?? null,
      user_agent: (ctx.userAgent ?? null)?.slice(0, 500) ?? null,
      org_id: ctx.orgId ?? null,
      metadata: ctx.metadata ?? {},
    } as never)
  } catch (e) {
    // On NE doit JAMAIS casser le flux user si l'audit fail.
    // Sentry captera l'erreur via console (instrumented).
    console.warn("[audit] logAuthEvent failed:", e instanceof Error ? e.message : e)
  }
}

/** Enregistre un échec auth + check si lockout via RPC. */
export async function recordAuthFail(ip: string | null | undefined, email: string | null | undefined): Promise<{ locked: boolean; fails: number }> {
  if (!ip) return { locked: false, fails: 0 }
  try {
    const admin = supabaseAdmin()
    const { data } = await admin.rpc("record_auth_fail", {
      p_ip: ip,
      p_email_hash: emailHash(email),
    } as never)
    const row = Array.isArray(data) ? data[0] : data
    const fails = (row?.fails as number | undefined) ?? 0
    const lockedUntil = row?.locked_until as string | null | undefined
    return { locked: !!lockedUntil && new Date(lockedUntil).getTime() > Date.now(), fails }
  } catch (e) {
    console.warn("[audit] recordAuthFail failed:", e instanceof Error ? e.message : e)
    return { locked: false, fails: 0 }
  }
}

/** Vérifie si l'IP/email est verrouillée. */
export async function isAuthLocked(ip: string | null | undefined, email: string | null | undefined): Promise<boolean> {
  if (!ip) return false
  try {
    const admin = supabaseAdmin()
    const { data } = await admin.rpc("is_auth_locked", {
      p_ip: ip,
      p_email_hash: emailHash(email),
    } as never)
    return Boolean(data)
  } catch (e) {
    console.warn("[audit] isAuthLocked failed:", e instanceof Error ? e.message : e)
    return false
  }
}

/** Reset lockout après login OK. */
export async function clearAuthLockout(ip: string | null | undefined, email: string | null | undefined): Promise<void> {
  if (!ip) return
  try {
    const admin = supabaseAdmin()
    await admin.rpc("clear_auth_lockout", {
      p_ip: ip,
      p_email_hash: emailHash(email),
    } as never)
  } catch (e) {
    console.warn("[audit] clearAuthLockout failed:", e instanceof Error ? e.message : e)
  }
}
