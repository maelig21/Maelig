/**
 * Gemini 2.5 Flash — ASR + extraction audio NATIF en un seul appel.
 * Remplace la pipeline 2-étapes (ASR DashScope → extraction DeepSeek).
 *
 * Gemini comprend l'audio nativement. Pas besoin de transcrire séparément.
 * Gratuit (1 500 req/j en free tier).
 *
 * Endpoint : Google AI Studio API (generativelanguage.googleapis.com)
 * Modèle : gemini-2.5-flash
 */
const KEY = process.env.GEMINI_API_KEY
const MODEL = "gemini-2.5-flash"

export interface GeminiExtraction {
  client_nom?: string
  client_prenom?: string
  client_telephone?: string
  client_email?: string
  client_adresse?: string
  client_ville?: string
  client_cp?: string
  chantier_adresse?: string
  chantier_objet?: string
  heures_main_oeuvre?: number
  items: Array<{ description: string; quantity: number; unit: string; category?: string }>
  notes?: string
}

/**
 * Envoie l'audio à Gemini 2.5 Flash qui le comprend et extrait
 * les infos structurées en UN SEUL appel.
 *
 * @param audioUrl URL signée de l'audio dans Supabase Storage
 * @param knownArticles Liste des articles connus du catalogue
 */
export async function geminiUnderstandAudio(
  audioUrl: string,
  knownArticles: string[] = [],
): Promise<{ extracted: GeminiExtraction; rawTranscript?: string }> {
  if (!KEY) throw new Error("GEMINI_API_KEY not configured")

  // 1. Download audio from Supabase signed URL
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`[gemini] audio download failed: ${audioRes.status}`)

  const audioBuffer = await audioRes.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString("base64")

  // Detect MIME from response or infer
  const contentType = audioRes.headers.get("content-type") || "audio/webm"

  // 2. Build prompt
  const knownList =
    knownArticles.length > 0
      ? `\nCatalogue connu (utilise le libellé exact si correspondance):\n${knownArticles.slice(0, 60).map((a) => `- ${a}`).join("\n")}`
      : ""

  const prompt = `Tu es un assistant pour électriciens. Un artisan vient de dicter un chantier au micro.

Écoute ATTENTIVEMENT l'audio et extrais TOUTES les informations en JSON.

${knownList}

Format JSON attendu :
{
  "transcription": "la transcription exacte mot pour mot",
  "client_nom": "nom de famille ou null",
  "client_prenom": "prénom ou null",
  "client_telephone": "numéro ou null",
  "client_email": "email ou null",
  "client_adresse": "numéro et rue ou null",
  "client_ville": "ville ou null",
  "client_cp": "code postal ou null",
  "chantier_adresse": "adresse chantier si différente ou null",
  "chantier_objet": "objet du devis ou null",
  "heures_main_oeuvre": nombre d'heures ou null,
  "notes": "infos utiles (urgence, accès, fourniture client…) ou null",
  "items": [
    { "description": "libellé clair", "quantity": nombre, "unit": "u|m|m2|ml|h|kg|ens|jour", "category": "catégorie ou null" }
  ]
}

RÈGLES ABSOLUES :
- Écoute chaque mot. Ne rate RIEN.
- "bis" dans une adresse → garde "bis"
- Noms propres → écris EXACTEMENT comme entendu
- Chiffres → retranscris exactement (pas d'arrondi)
- Si qtte absente → quantity: 1
- Si l'artisan épelle un mot → retranscris l'épellation exacte
- N'invente JAMAIS de matériel non mentionné`

  // 3. Call Gemini API
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: contentType, data: audioBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.05, // très froid pour max fidélité
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`[gemini] ${res.status} ${err.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("[gemini] empty response")

  // 4. Parse JSON
  // Gemini with response_mime_type=application/json returns clean JSON
  const parsed = JSON.parse(text) as GeminiExtraction & { transcription?: string }

  return {
    extracted: {
      client_nom: parsed.client_nom || undefined,
      client_prenom: parsed.client_prenom || undefined,
      client_telephone: parsed.client_telephone || undefined,
      client_email: parsed.client_email || undefined,
      client_adresse: parsed.client_adresse || undefined,
      client_ville: parsed.client_ville || undefined,
      client_cp: parsed.client_cp || undefined,
      chantier_adresse: parsed.chantier_adresse || undefined,
      chantier_objet: parsed.chantier_objet || undefined,
      heures_main_oeuvre:
        typeof parsed.heures_main_oeuvre === "number" ? parsed.heures_main_oeuvre : undefined,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((it) => ({
            description: String(it.description ?? "").slice(0, 240) || "Article",
            quantity:
              Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0
                ? Number(it.quantity)
                : 1,
            unit: ["u", "m", "m2", "ml", "h", "kg", "ens", "jour"].includes(String(it.unit))
              ? (it.unit as string)
              : "u",
            category: String(it.category ?? "") || undefined,
          }))
        : [],
      notes: parsed.notes || undefined,
    },
    rawTranscript: parsed.transcription,
  }
}
