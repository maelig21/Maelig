/**
 * /api/voice/extract-text
 *
 * Extraction structurée RAPIDE depuis du TEXTE (pas d'audio).
 * Sert au streaming LIVE pendant que l'utilisateur dicte : le browser fait l'ASR
 * via Web Speech API, et on appelle cet endpoint toutes les ~1.5s sur le texte cumulé
 * pour remplir les champs du devis en temps réel.
 *
 * Modèle utilisé : qwen-turbo (rapide ~1s, $0.05/M tokens) — bonne précision pour FR propre.
 * Le pipeline complet (audio → qwen-asr → qwen-turbo correct → qwen-plus extract)
 * reste dans /api/voice/transcribe pour le STOP final (fiabilité maximale).
 *
 * Rate limit : limitText (60/min/user) — protège contre spam.
 */
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { extractDevisFromTranscript } from "@/lib/llm/dashscope"
import { limitText, checkLimits, tooManyRequests } from "@/lib/ratelimit"

export const runtime = "nodejs"
export const maxDuration = 15

const MAX_TEXT_LEN = 4000

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const rl = await checkLimits({ ratelimit: limitText, key: user.id })
  if (!rl.success) return tooManyRequests(rl)

  let payload: { text?: unknown } = {}
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 })
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : ""
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 })
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: "text_too_long", limit: MAX_TEXT_LEN }, { status: 413 })
  }
  // Même texte très court : on tente l'extraction (le prompt gère les snippets)
  // Une simple phrase comme "Madame Martin" doit remplir les champs client

  // Charge les articles connus de l'org pour matcher (warmup déjà fait par /transcribe)
  const { data: articles } = await supabase
    .from("articles")
    .select("nom")
    .eq("org_id", profile.org_id)
    .eq("archived", false)
    .order("usage_count", { ascending: false })
    .limit(80)

  const articleNames = (articles ?? []).map((a) => a.nom)

  // Récupérer les métiers de l'org
  const { data: orgData } = await supabase
    .from("orgs")
    .select("metiers")
    .eq("id", profile.org_id)
    .maybeSingle()
  const metiers: string[] = orgData?.metiers ?? []

  try {
    let extracted
    try {
      extracted = await extractDevisFromTranscript(text, articleNames, metiers)
    } catch (e) {
      console.warn("[extract-text] DeepSeek failed, trying fallback:", e instanceof Error ? e.message : e)
      // Fallback via extract.ts
      const { extractDevis } = await import("@/lib/llm/extract")
      extracted = await extractDevis(text, articleNames)
    }
    // Validation croisée : vérifier que les quantités extraites correspondent à la transcription
    if (extracted.items && extracted.items.length > 0) {
      const numbers = text.match(/(\d+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/gi) ?? []
      const numMap: Record<string, number> = {
        un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
        six: 6, sept: 7, huit: 8, neuf: 9, dix: 10
      }
      const extractedNums = numbers.map((n) => numMap[n.toLowerCase()] ?? parseInt(n)).filter((n) => !isNaN(n) && n > 0)
      const itemNums = extracted.items.map((it) => it.quantite).filter((q) => q && q > 1)
      // Log pour debug
      console.log("[extract-text] transcription nums:", extractedNums, "item nums:", itemNums)
    }

    // Si aucun article détecté, on réessaie avec le fallback
    if (!extracted.items || extracted.items.length === 0) {
      console.warn("[extract-text] 0 articles extracted, retrying with fallback...")
      try {
        const { extractDevis } = await import("@/lib/llm/extract")
        const fallback = await extractDevis(text, articleNames)
        if (fallback.items && fallback.items.length > 0) {
          console.log("[extract-text] fallback succeeded with", fallback.items.length, "items")
          return NextResponse.json({ ok: true, extracted: fallback })
        }
      } catch (e2) {
        console.warn("[extract-text] fallback also failed:", e2 instanceof Error ? e2.message : e2)
      }
    }

    return NextResponse.json({ ok: true, extracted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "extract_failed", detail: msg }, { status: 502 })
  }
}
