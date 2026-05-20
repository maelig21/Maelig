/**
 * ASR (Speech-to-Text) via DashScope Qwen3-ASR-Flash multimodal endpoint.
 *
 * Fix 2026-05-20 : ancien paraformer-v2 / async-batch a été retiré du tier
 * international DashScope. Migration vers qwen3-asr-flash-2026-02-10 sur
 * l'endpoint multimodal-generation (synchrone, ~3-5s pour audio 30-90s).
 *
 * Audio uploaded to Supabase Storage → public signed URL → DashScope sync
 * call → text + detected language.
 */

const ENDPOINT = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
const KEY = process.env.DASHSCOPE_API_KEY
const MODEL = "qwen3-asr-flash-2026-02-10"

export async function transcribeAudioFromUrl(
  audioUrl: string,
  languageHint?: string,
): Promise<{ text: string; language?: string; raw: unknown }> {
  if (!KEY) throw new Error("DASHSCOPE_API_KEY not configured")

  // Construct multimodal message. Le prompt système oriente le LLM ASR pour
  // qu'il restitue le contenu en BTP/devis sans hallucination.
  const systemPrompt = languageHint
    ? `Transcrire l'audio en ${languageHint}. Conserver le vocabulaire technique BTP/électrique fidèlement.`
    : `Transcrire l'audio dans la langue détectée (fr/en/ar/es/pt). Conserver le vocabulaire technique BTP/électrique fidèlement, sans ajouter d'interprétation.`

  const body = {
    model: MODEL,
    input: {
      messages: [
        { role: "system", content: [{ text: systemPrompt }] },
        { role: "user", content: [{ audio: audioUrl }] },
      ],
    },
    parameters: {
      asr_options: {
        enable_lid: true,       // language detection
        enable_itn: true,       // inverse text normalization (chiffres → "5" au lieu de "cinq")
      },
    },
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`[asr] ${res.status} ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    output?: {
      choices?: Array<{
        finish_reason?: string
        message?: {
          annotations?: Array<{ language?: string; emotion?: string; type?: string }>
          content?: Array<{ text?: string }>
          role?: string
        }
      }>
    }
    usage?: unknown
    request_id?: string
  }

  const choice = data.output?.choices?.[0]
  const textParts = choice?.message?.content ?? []
  const text = textParts.map((c) => c.text ?? "").join("").trim()
  const language = choice?.message?.annotations?.find((a) => a.type === "audio_info")?.language

  if (!text) {
    throw new Error("[asr] no text in response")
  }

  return { text, language, raw: data }
}
