"use client"
import { useState } from "react"
import { toast } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Boutons OAuth 1-clic : Google + Apple (+ stub Facebook si besoin futur).
 *
 * Pré-requis Supabase :
 * - Auth Providers → Google → enable + client_id + secret + redirect URL
 * - Auth Providers → Apple → enable + Services ID + Team ID + Key ID + Private Key
 * - Site URL = production URL (sinon redirect cassé)
 */
export function OAuthButtons({ redirectTo, mode = "login" }: { redirectTo?: string; mode?: "login" | "signup" }) {
  const [pending, setPending] = useState<"google" | "apple" | null>(null)

  async function signIn(provider: "google" | "apple") {
    setPending(provider)
    const supabase = createSupabaseBrowserClient()
    const url = typeof window !== "undefined" ? window.location.origin : ""
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${url}${redirectTo ?? "/app"}`,
        queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
      },
    })
    if (error) {
      toast.error(`Connexion ${provider} impossible`, { description: error.message })
      setPending(null)
    }
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className={cn(
          "group relative w-full inline-flex items-center justify-center gap-3 h-12 rounded-[var(--radius)]",
          "bg-white text-[#1f1f1f] font-medium text-sm border border-white/0",
          "hover:bg-[#f8f9fa] active:scale-[0.98] transition-all",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "shadow-[0_2px_6px_rgba(0,0,0,0.2)]",
        )}
      >
        {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continuer avec Google
      </button>

      <button
        type="button"
        onClick={() => signIn("apple")}
        disabled={pending !== null}
        className={cn(
          "group relative w-full inline-flex items-center justify-center gap-3 h-12 rounded-[var(--radius)]",
          "bg-black text-white font-medium text-sm border border-white/10",
          "hover:bg-[#1a1a1a] active:scale-[0.98] transition-all",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        {pending === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
        Continuer avec Apple
      </button>

      <p className="text-[11px] text-muted-2 text-center mt-2">
        {mode === "signup" ? "Création" : "Connexion"} 1-clic. Aucune carte bancaire demandée.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.89c1.7-1.57 2.7-3.88 2.7-6.61z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.89-2.26c-.8.54-1.83.86-3.07.86-2.36 0-4.36-1.6-5.07-3.74H.96v2.33A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.93 10.68A5.4 5.4 0 0 1 3.64 9c0-.58.1-1.15.29-1.68V4.99H.96A8.997 8.997 0 0 0 0 9c0 1.45.35 2.83.96 4.01l2.97-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.51.46 3.44 1.34l2.58-2.58A8.99 8.99 0 0 0 9 0 8.997 8.997 0 0 0 .96 4.99l2.97 2.33C4.64 5.18 6.64 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
      <path d="M13.06 9.6c-.02-1.92 1.57-2.83 1.65-2.88-.9-1.32-2.3-1.5-2.8-1.52-1.19-.12-2.32.7-2.93.7-.61 0-1.55-.68-2.55-.66-1.3.02-2.51.76-3.18 1.93-1.36 2.36-.35 5.85.98 7.76.65.93 1.42 1.98 2.43 1.94.97-.04 1.34-.63 2.52-.63 1.17 0 1.51.63 2.55.61 1.05-.02 1.72-.95 2.36-1.89.75-1.09 1.05-2.14 1.07-2.2-.02-.01-2.05-.79-2.1-3.16z M11.32 3.59c.54-.65.9-1.55.8-2.46-.78.03-1.71.52-2.27 1.17-.5.58-.94 1.5-.82 2.39.86.07 1.74-.44 2.29-1.1z"/>
    </svg>
  )
}
