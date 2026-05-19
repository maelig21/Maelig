/**
 * POST /api/incidents
 * Crée un incident à partir d'un FormData :
 *  - audio (Blob) : optionnel, vocal de l'employé
 *  - photos[] (Files) : 0..10 photos
 *  - videos[] (Files) : 0..3 vidéos
 *  - text (string) : si pas d'audio, message texte
 *  - chantier_id, devis_id, client_id (optionnels)
 *
 * Flow :
 *  1. Upload media vers Storage `chantier-media/{org_id}/incidents/{id}/...`
 *  2. ASR sur l'audio si présent (paraformer-v2)
 *  3. Correction FR du transcript
 *  4. analyzeIncident → titre, urgency, score, résumé, action recommandée
 *  5. Insert dans incidents + premier message dans incident_messages
 *  6. Notif email patron si urgency >= important
 */
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { transcribeAudioFromUrl } from "@/lib/llm/asr"
import { correctFR } from "@/lib/llm/dashscope"
import { analyzeIncident } from "@/lib/llm/incidents"
import { sendEmail } from "@/lib/email/resend"

export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, full_name, langue_maternelle")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "form_required" }, { status: 400 })

  const audio = form.get("audio") as File | null
  const textMsg = (form.get("text") as string | null)?.trim() ?? ""
  const chantierId = (form.get("chantier_id") as string | null) || null
  const devisId = (form.get("devis_id") as string | null) || null
  const clientId = (form.get("client_id") as string | null) || null

  if (!audio && !textMsg) {
    return NextResponse.json({ error: "audio_or_text_required" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const incidentId = crypto.randomUUID()
  const folder = `${profile.org_id}/incidents/${incidentId}`

  // 1) Upload audio if any
  let audioPath: string | null = null
  let audioUrl: string | null = null
  if (audio && audio.size > 0) {
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "audio_too_large", limit_mb: 25 }, { status: 413 })
    }
    audioPath = `${folder}/audio.${guessExt(audio.type)}`
    const buf = Buffer.from(await audio.arrayBuffer())
    const { error } = await admin.storage.from("chantier-media").upload(audioPath, buf, {
      contentType: audio.type || "audio/webm",
      upsert: false,
    })
    if (error) return NextResponse.json({ error: "audio_upload_failed", detail: error.message }, { status: 500 })
    const { data: signed } = await admin.storage.from("chantier-media").createSignedUrl(audioPath, 60 * 30)
    audioUrl = signed?.signedUrl ?? null
  }

  // 2) Upload photos + videos
  const attachments: Array<{ path: string; type: string; name: string; size: number }> = []
  for (const field of ["photos", "videos"]) {
    const files = form.getAll(field) as File[]
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f || f.size === 0) continue
      if (f.size > 30 * 1024 * 1024) continue
      const ext = guessExt(f.type) || (field === "videos" ? "mp4" : "jpg")
      const path = `${folder}/${field}-${i}.${ext}`
      const buf = Buffer.from(await f.arrayBuffer())
      const { error } = await admin.storage.from("chantier-media").upload(path, buf, {
        contentType: f.type,
        upsert: false,
      })
      if (!error) {
        attachments.push({ path, type: f.type, name: f.name || `${field}-${i}`, size: f.size })
      }
    }
  }
  const photoCount = attachments.filter((a) => a.type.startsWith("image/")).length
  const videoCount = attachments.filter((a) => a.type.startsWith("video/")).length

  // 3) Transcription
  let rawTranscript = textMsg
  let langDetected: string | undefined
  if (audioUrl) {
    try {
      const tr = await transcribeAudioFromUrl(audioUrl, profile.langue_maternelle ?? undefined)
      rawTranscript = (rawTranscript ? rawTranscript + "\n" : "") + (tr.text ?? "")
      langDetected = tr.language ?? undefined
    } catch (e) {
      console.warn("[incident] ASR failed:", e instanceof Error ? e.message : e)
    }
  }

  const corrected = rawTranscript ? await correctFR(rawTranscript).catch(() => rawTranscript) : ""

  // 4) Chantier/client labels for context
  let chantierLabel: string | undefined
  let clientLabel: string | undefined
  if (chantierId) {
    const { data: c } = await supabase.from("chantiers").select("nom").eq("id", chantierId).maybeSingle()
    chantierLabel = c?.nom ?? undefined
  }
  if (clientId) {
    const { data: c } = await supabase.from("clients").select("nom, prenom, raison_sociale").eq("id", clientId).maybeSingle()
    if (c) chantierLabel = chantierLabel ?? (c.raison_sociale || `${c.prenom ?? ""} ${c.nom}`.trim())
  }

  const analysis = await analyzeIncident({
    transcript: corrected || rawTranscript || "(photo/vidéo sans message)",
    language: langDetected,
    photo_count: photoCount,
    video_count: videoCount,
    chantier_label: chantierLabel,
    client_label: clientLabel,
  })

  // 5) Insert incident
  const { error: insErr } = await admin.from("incidents").insert({
    id: incidentId,
    org_id: profile.org_id,
    sender_id: user.id,
    chantier_id: chantierId,
    devis_id: devisId,
    client_id: clientId,
    titre: analysis.titre,
    description_raw: rawTranscript || null,
    description_corrigee: corrected || null,
    lang_detected: langDetected ?? null,
    audio_url: audioPath,
    attachments,
    urgency: analysis.urgency,
    ai_priorite_score: analysis.ai_priorite_score,
    ai_resume: analysis.ai_resume,
    ai_action_recommandee: analysis.ai_action_recommandee,
  } as never)
  if (insErr) return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500 })

  // 6) Insert premier message
  await admin.from("incident_messages").insert({
    incident_id: incidentId,
    sender_id: user.id,
    body_raw: rawTranscript || "(photos/vidéos)",
    body_corrected: corrected || null,
    audio_url: audioPath,
    attachments,
  } as never)

  // 7) Notif email patron si important / urgent
  if (analysis.urgency === "urgent" || analysis.urgency === "important") {
    try {
      // Trouve les owners de l'org
      const { data: owners } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("org_id", profile.org_id)
        .in("role", ["owner", "admin_dep"])
      const recipients = (owners ?? []).map((o) => o.email).filter(Boolean) as string[]
      if (recipients.length > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dep-electrique.vercel.app"
        await sendEmail({
          to: recipients,
          subject: `[DEP · ${analysis.urgency.toUpperCase()}] ${analysis.titre}`,
          html: `<div style="font-family:Inter,sans-serif;background:#07070b;color:#f4f4f5;padding:24px"><div style="max-width:560px;margin:auto;background:#14141d;border:1px solid #25252f;border-radius:14px;padding:24px"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${analysis.urgency === "urgent" ? "#ef4444" : "#f59e0b"};font-weight:700">⚡ ${analysis.urgency}</div><h1 style="font-size:22px;margin:8px 0 12px;font-weight:800">${escapeHtml(analysis.titre)}</h1><p style="margin:0 0 12px;color:#d4d4d8;line-height:1.5">${escapeHtml(analysis.ai_resume)}</p><div style="background:#1d1d28;border-radius:8px;padding:12px;margin:16px 0"><div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a1a1aa;margin-bottom:4px">Action recommandée</div><div style="color:#ffd500;font-weight:600">${escapeHtml(analysis.ai_action_recommandee)}</div></div><div style="font-size:12px;color:#a1a1aa">Envoyé par ${escapeHtml(profile.full_name ?? user.email ?? "")} - ${photoCount} photo(s), ${videoCount} vidéo(s)</div><a href="${baseUrl}/app/incidents/${incidentId}" style="display:inline-block;margin-top:18px;padding:12px 22px;background:#ffd500;color:#000;text-decoration:none;font-weight:700;border-radius:10px">Voir le signalement</a></div></div>`,
          text: `[${analysis.urgency.toUpperCase()}] ${analysis.titre}\n\n${analysis.ai_resume}\n\nAction: ${analysis.ai_action_recommandee}\n\nVoir: ${baseUrl}/app/incidents/${incidentId}`,
        })
      }
    } catch (e) {
      console.warn("[incident] email notify failed:", e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({
    ok: true,
    incident: { id: incidentId, ...analysis },
  })
}

function guessExt(mime: string): string {
  if (!mime) return "bin"
  if (mime.includes("webm")) return "webm"
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("quicktime")) return "mov"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("png")) return "png"
  if (mime.includes("heic")) return "heic"
  if (mime.includes("webp")) return "webp"
  return mime.split("/")[1] ?? "bin"
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
