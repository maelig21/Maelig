"use client"
import { useEffect, useRef, useState } from "react"
import { Mic, Square, Loader2, Sparkles, Smartphone, Monitor } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ExtractedDevis } from "@/lib/llm/dashscope"
import type { Clarification } from "@/lib/llm/clarify"
import { useLiveTranscript } from "@/lib/use-live-transcript"
import { useMicPermission, isMobileDevice } from "@/lib/use-mic-permission"

interface Result {
  raw: string
  corrected: string
  language?: string
  extracted: ExtractedDevis
  clarification?: Clarification | null
  _diagnostic?: {
    pipeline?: string
    extract_error?: string | null
    extract_fallback_used?: boolean
    clarify_error?: string | null
  }
}

export interface PartialResult {
  text: string
  extracted: ExtractedDevis
}

export function VoiceRecorder({
  onResult,
  onPartialResult,
  className,
  large = true,
}: {
  onResult: (r: Result) => void
  onPartialResult?: (p: PartialResult) => void
  className?: string
  large?: boolean
}) {
  const mobile = isMobileDevice()
  const mic = useMicPermission()

  // Mode mobile = Web Speech API uniquement (pas de MediaRecorder/getUserMedia)
  // → pas d'indicateur d'enregistrement téléphone visible sur iOS/Android
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [extractingLive, setExtractingLive] = useState(false)

  // Refs pour les timeouts (évite stale closure)
  const recordingRef = useRef(false)
  const mobileTickRef = useRef<number | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Desktop only (MediaRecorder / stream)
  const chunksRef = useRef<Blob[]>([])
  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const tickRef = useRef<number | null>(null)
  const tStartRef = useRef<number>(0)
  const lastExtractedTextRef = useRef<string>("")
  const mobileStartRef = useRef<number>(0)

  const live = useLiveTranscript({ lang: "fr-FR" })

  // Cleanup
  useEffect(() => () => stopStream(), [])

  // ═══════════════════════════════════════
  // LIVE EXTRACTION PARTIELLE (les deux modes)
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!recording || !onPartialResult || !live.isSupported) return
    const pauseMs = live.msSinceLastWord ?? 0
    if (pauseMs < 1200) return
    const fullText = (live.finalText + (live.interim ? " " + live.interim : "")).trim()
    if (!fullText || fullText.length < 8) return
    if (fullText === lastExtractedTextRef.current) return
    lastExtractedTextRef.current = fullText
    setExtractingLive(true)
    fetch("/api/voice/extract-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fullText }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.extracted) {
          onPartialResult({ text: fullText, extracted: data.extracted })
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setExtractingLive(false))
  }, [live.msSinceLastWord, recording, onPartialResult, live.isSupported])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (tickRef.current) cancelAnimationFrame(tickRef.current)
    tickRef.current = null
  }

  // ═══════════════════════════════════════
  // MOBILE PATH — Web Speech API seulement
  // ═══════════════════════════════════════
  async function startMobile() {
    // Si la Web Speech API n'est pas disponible sur ce mobile → pas de getUserMedia
    // (ça déclencherait l'enregistrement téléphone = exactement ce qu'on veut éviter)
    if (!live.isSupported) {
      toast.error("Dictée vocale indisponible", {
        description: "Votre navigateur ne supporte pas la dictée. Utilisez la saisie clavier.",
      })
      return
    }

    // Pré-vérifie la permission micro
    if (mic.needsPrompt) {
      const result = await mic.request()
      if (result !== "granted") {
        toast.error("Micro nécessaire", {
          description: "Autorisez l'accès au micro dans les réglages de votre téléphone.",
        })
        return
      }
    }

    recordingRef.current = true
    setRecording(true)
    setSeconds(0)
    mobileStartRef.current = Date.now()
    lastExtractedTextRef.current = ""
    live.reset()
    live.start()

    // Tick timer pour l'affichage des secondes
    const tick = () => {
      setSeconds(Math.floor((Date.now() - mobileStartRef.current) / 1000))
      setLevel(Math.random() * 0.4 + 0.1) // VU mètre simulé (pas d'audio stream)
      mobileTickRef.current = requestAnimationFrame(tick)
    }
    tick()

    // Auto-stop à 120s (utilise recordingRef pour éviter stale closure)
    autoStopRef.current = setTimeout(() => {
      if (recordingRef.current) stopMobile()
    }, 120_000)
  }

  async function stopMobile() {
    if (mobileTickRef.current) cancelAnimationFrame(mobileTickRef.current)
    mobileTickRef.current = null
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    recordingRef.current = false
    live.stop()
    setRecording(false)
    setTranscribing(true)

    const rawText = live.finalText.trim()
    if (!rawText) {
      toast.error("Aucune parole détectée", { description: "Rien n'a été transcrit. Réessayez." })
      setTranscribing(false)
      return
    }

    // Envoie le texte brut à l'extraction serveur (pas d'audio)
    try {
      const res = await fetch("/api/voice/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (data?.error) {
        toast.error("Erreur d'extraction", { description: data.error })
        return
      }
      // Fallback client-side si le LLM n'a pas extrait les champs client
      const extracted = data.extracted ?? { items: [] }
      if (!extracted.client_nom && !extracted.client_hint && !extracted.client_telephone) {
        const phoneMatch = rawText.match(/(0[1-9])([\s.-]*\d{2}){4}/)
        if (phoneMatch) extracted.client_telephone = phoneMatch[0]
        // Si un truc ressemble à un nom (2+ mots, pas juste des chiffres)
        const words = rawText.replace(phoneMatch?.[0] || "", "").trim().split(/\s+/).filter(Boolean)
        if (words.length >= 1 && !/^\d+$/.test(words[0])) {
          extracted.client_hint = words.join(" ")
        }
      }
      onResult({
        raw: rawText,
        corrected: data.corrected ?? rawText,
        language: data.language,
        extracted,
        clarification: data.clarification ?? null,
        _diagnostic: { pipeline: "mobile-speechrec-only" },
      })
    } catch (e) {
      toast.error("Erreur réseau", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setTranscribing(false)
    }
  }

  // ═══════════════════════════════════════
  // DESKTOP PATH — MediaRecorder + ASR serveur (inchangé)
  // ═══════════════════════════════════════
  async function startDesktop() {
    // Pré-vérifie la permission
    if (mic.needsPrompt) {
      const result = await mic.request()
      if (result !== "granted") {
        toast.error("Micro nécessaire", { description: "Autorisez l'accès au micro." })
        return
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: pickMimeType() })
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" })
        chunksRef.current = []
        stopStream()
        await uploadDesktop(blob)
      }
      mr.start(250)
      recordingRef.current = true
      setRecording(true)
      tStartRef.current = Date.now()
      lastExtractedTextRef.current = ""
      live.reset()
      live.start()
      animateDesktop(stream)
      setTimeout(() => mr.state === "recording" && stopDesktop(), 120_000)
    } catch (e) {
      toast.error("Micro inaccessible", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  function stopDesktop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop()
    }
    live.stop()
    setRecording(false)
  }

  function animateDesktop(stream: MediaStream) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(Math.min(1, rms * 4))
      setSeconds(Math.floor((Date.now() - tStartRef.current) / 1000))
      tickRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function uploadDesktop(blob: Blob) {
    setTranscribing(true)
    try {
      const fd = new FormData()
      const ext = mr.mimeType?.includes("mp4") ? "mp4" : mr.mimeType?.includes("ogg") ? "ogg" : "webm"
      fd.append("audio", blob, `chantier-${Date.now()}.${ext}`)
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd })
      const data = (await res.json()) as Partial<Result> & { error?: string; detail?: string }
      if (!res.ok || data.error) {
        toast.error("Transcription échouée", { description: data.detail ?? data.error })
        return
      }
      onResult({
        raw: data.raw ?? "",
        corrected: data.corrected ?? "",
        language: data.language,
        extracted: data.extracted ?? { items: [] },
        clarification: data.clarification ?? null,
        _diagnostic: data._diagnostic,
      })
    } catch (e) {
      toast.error("Erreur réseau", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setTranscribing(false)
    }
  }

  // ═══════════════════════════════════════
  // START / STOP dispatcher
  // ═══════════════════════════════════════
  function handleClick() {
    if (recording) {
      mobile ? stopMobile() : stopDesktop()
    } else {
      mobile ? startMobile() : startDesktop()
    }
  }

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Badge mode */}
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
        mobile ? "bg-wire-blue/10 text-wire-blue" : "bg-electric/10 text-electric",
      )}>
        {mobile ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
        Mode {mobile ? "mobile" : "desktop"}
      </span>

      {/* Permission request CTA (si pas encore accordée) */}
      {mic.needsPrompt && !recording && !transcribing && (
        <div className={cn(
          "rounded-[var(--radius)] border px-4 py-2 text-xs text-center",
          mic.status === "denied"
            ? "border-danger/30 bg-danger/5 text-danger"
            : "border-electric/30 bg-surface-2 text-muted",
        )}>
          {mic.status === "denied"
            ? "🔇 Micro bloqué — allez dans Réglages > Safari > Microphone pour autoriser"
            : "Appuyez sur le micro pour autoriser l'accès (une seule fois)"
          }
        </div>
      )}

      {/* Bouton micro principal */}
      <button
        type="button"
        disabled={transcribing}
        onClick={handleClick}
        aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
        className={cn(
          "relative grid place-items-center rounded-full transition-transform active:scale-95",
          large ? "h-32 w-32" : "h-20 w-20",
          recording
            ? "bg-danger text-white"
            : "bg-gradient-to-br from-electric to-electric-deep text-black",
          transcribing && "opacity-70",
          "shadow-[0_18px_60px_-12px_rgba(255,213,0,0.6)]",
        )}
      >
        {recording &&
          [0.4, 0.7, 1.05].map((s, i) => (
            <span
              key={i}
              className="absolute inset-0 rounded-full border border-danger/40"
              style={{
                transform: `scale(${1 + level * s})`,
                transition: "transform 60ms ease-out",
                opacity: 0.6 - i * 0.15,
              }}
            />
          ))}
        {transcribing ? (
          <Loader2 className={cn("animate-spin", large ? "h-12 w-12" : "h-8 w-8")} />
        ) : recording ? (
          <Square className={cn(large ? "h-12 w-12" : "h-8 w-8")} fill="currentColor" />
        ) : (
          <Mic className={cn(large ? "h-12 w-12" : "h-8 w-8")} />
        )}
      </button>

      {/* Timer + status */}
      <div className="text-center min-h-[2rem]">
        {recording ? (
          <p className="text-sm">
            <span className="font-mono text-foreground">{formatSeconds(seconds)}</span>{" "}
            <span className="text-muted">· parlez normalement…</span>
            {extractingLive && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-electric">
                <Sparkles className="h-3 w-3 animate-pulse" />
                je remplis…
              </span>
            )}
          </p>
        ) : transcribing ? (
          <p className="text-sm text-muted inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-electric" />
            {mobile ? "Analyse de votre description…" : "On écoute, on corrige, on structure…"}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {mobile
              ? "Appuyez et dictez votre chantier."
              : "Appuyez pour décrire votre chantier."
            }
          </p>
        )}
      </div>

      {/* PANNEAU LIVE : transcription en direct (Web Speech API) */}
      {recording && live.isSupported && (
        <div className="w-full max-w-xl rounded-[var(--radius)] border border-electric/40 bg-electric/5 px-4 py-3 text-left">
          <div className="text-[10px] uppercase tracking-[0.16em] text-electric mb-1.5">Vous dites</div>
          <p className="text-sm leading-relaxed text-foreground/90 min-h-[1.5rem]">
            {live.finalText ? (
              <span>{live.finalText}</span>
            ) : null}
            {live.interim ? (
              <span className="text-muted italic"> {live.interim}</span>
            ) : null}
            {!live.finalText && !live.interim && (
              <span className="text-muted italic">en attente de votre voix…</span>
            )}
          </p>
        </div>
      )}
      {recording && !live.isSupported && (
        <p className="text-[11px] text-muted-2 text-center">
          {mobile
            ? "(Transcription après arrêt — votre navigateur ne supporte pas l'aperçu en direct)"
            : "(Aperçu live indisponible sur ce navigateur — transcription complète après le stop)"
          }
        </p>
      )}
    </div>
  )
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
  for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c
  return ""
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`
}
