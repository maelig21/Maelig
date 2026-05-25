"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Hook de pré-vérification & cache de la permission microphone.
 *
 * Problème résolu : sur mobile (iOS Safari, Android Chrome), navigator.mediaDevices.getUserMedia()
 * déclenche la popup OS à CHAQUE appel si la permission n'est pas pré-vérifiée.
 * Ce hook :
 *   1. Vérifie avec navigator.permissions.query (lorsque disponible)
 *   2. Cache le résultat dans localStorage (TTL 7 jours)
 *   3. Permet de savoir si la permission est déjà accordée AVANT d'appeler getUserMedia
 *
 * Cache key: dep_mic_permission_{origin}
 */

const STORAGE_KEY_PREFIX = "dep_mic_permission_"
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

export type MicPermission = "granted" | "prompt" | "denied" | "unsupported" | "unknown"

interface MicPermissionResult {
  status: MicPermission
  /** Vrai si une popup de demande est nécessaire (status=prompt) */
  needsPrompt: boolean
  /** Vrai si l'utilisateur a déjà donné → pas de popup attendue */
  ready: boolean
  /** Demander explicitement la permission (ne fait rien si déjà accordée/refusée) */
  request: () => Promise<MicPermission>
  /** Réinitialiser le cache */
  resetCache: () => void
}

function getStorageKey(): string {
  if (typeof window === "undefined") return STORAGE_KEY_PREFIX + "unknown"
  return STORAGE_KEY_PREFIX + window.location.origin
}

function readCache(): MicPermission | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey())
    if (!raw) return null
    const { status, ts } = JSON.parse(raw) as { status: MicPermission; ts: number }
    if (Date.now() - ts > CACHE_TTL_MS) {
      window.localStorage.removeItem(getStorageKey())
      return null
    }
    return status
  } catch {
    return null
  }
}

function writeCache(status: MicPermission) {
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify({ status, ts: Date.now() }))
  } catch { /* silent */ }
}

/**
 * Détection mobile basée sur userAgent + touch support.
 * Utilisée pour décider du pipeline vocal.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua) ||
    ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 0 && !/macintosh|windows|linux/i.test(ua))
  )
}

export function useMicPermission(): MicPermissionResult {
  const [status, setStatus] = useState<MicPermission>("unknown")
  const requestedRef = useRef(false)

  useEffect(() => {
    // 1. Essaye le cache localStorage
    const cached = readCache()
    if (cached) {
      setStatus(cached)
      if (cached === "granted") requestedRef.current = true
      return
    }

    // 2. Essaye Permissions API (support navigateur inégal)
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      // Permissions API non dispo → on ne peut pas pré-vérifier
      setStatus("unsupported")
      return
    }

    let cancelled = false
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((perm) => {
        if (cancelled) return
        const s = perm.state as MicPermission
        setStatus(s)
        writeCache(s)
        if (s === "granted") requestedRef.current = true

        // Écouter les changements de permission (si l'user change dans les settings OS)
        perm.addEventListener("change", () => {
          const ns = perm.state as MicPermission
          setStatus(ns)
          writeCache(ns)
        })
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported")
      })

    return () => { cancelled = true }
  }, [])

  const request = useCallback(async (): Promise<MicPermission> => {
    if (requestedRef.current) return status
    requestedRef.current = true

    // Si la Permission API dit déjà granted/denied
    if (status === "granted") return "granted"
    if (status === "denied") return "denied"

    // getUserMedia déclenche la popup de permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.getTracks().forEach((t) => t.stop())
      const s: MicPermission = "granted"
      setStatus(s)
      writeCache(s)
      return s
    } catch (e) {
      const s: MicPermission = (e as DOMException)?.name === "NotAllowedError" ? "denied" : "denied"
      setStatus(s)
      writeCache(s)
      return s
    }
  }, [status])

  const resetCache = useCallback(() => {
    try { window.localStorage.removeItem(getStorageKey()) } catch { /* */ }
    setStatus("unknown")
    requestedRef.current = false
  }, [])

  return {
    status,
    needsPrompt: status === "prompt" || status === "unknown" || status === "unsupported",
    ready: status === "granted",
    request,
    resetCache,
  }
}
