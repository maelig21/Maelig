/**
 * Sentry init partagé client/server/edge.
 * Si SENTRY_DSN absent → init désactivé (pas de crash, pas d'overhead).
 *
 * P1 audit 2026-05-20 — beforeSend renforcé via sentry-redact.ts pour stripper
 * tout PII (email, IBAN, CB, JWT, Stripe key, SIRET, téléphone, cookies,
 * Authorization, body params sensibles, breadcrumbs).
 *
 * Free tier Sentry : 5 000 errors / mois, gardés 30 jours. Suffisant MVP.
 */
import * as Sentry from "@sentry/nextjs"
import { sentryBeforeSend } from "./security/sentry-redact"

export function initSentry(scope: "client" | "server" | "edge") {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: scope === "server" ? 0.05 : 0.1,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: scope === "client" ? 0.2 : 0,
    sendDefaultPii: false,                          // never send IP / user-agent / cookies by default
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    normalizeDepth: 5,
    ignoreErrors: [
      // Bruit navigateur classique sans valeur debug
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "Network request failed",
      // Bots / scanners
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend: sentryBeforeSend,
    beforeBreadcrumb(crumb) {
      // Drop fetch breadcrumbs sur Supabase auth (peuvent contenir tokens)
      if (crumb.category === "fetch" && typeof crumb.data?.url === "string") {
        const u = crumb.data.url as string
        if (u.includes("/auth/v1/") || u.includes("/auth/v1/token") || u.includes("/auth/v1/user")) {
          return null
        }
      }
      return crumb
    },
  })
}
