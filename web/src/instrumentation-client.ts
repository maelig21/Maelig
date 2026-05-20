// Next 15 client instrumentation — équivalent client de src/instrumentation.ts.
// Charge sentry.client.config.ts pour activer Sentry côté browser.
// Sans ce fichier, NEXT_PUBLIC_SENTRY_DSN est ignoré côté client (les erreurs
// browser ne remontent pas à Sentry).
//
// P1 audit 2026-05-20 — fix après détection "Total chunks with Sentry: 0" en prod.

import "../sentry.client.config"
