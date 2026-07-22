"use client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input, Label, FieldError } from "@/components/ui/input"

// P1-2 audit 2026-05-20 — Aligné avec /inscription : 12 chars + checkPasswordStrength
import { checkPasswordStrength } from "@/lib/security/password"

const schema = z.object({
  password: z.string().min(12, "12 caractères minimum (sécurité données client)").max(72),
})
type FormValues = z.infer<typeof schema>

export default function ReinitPage() {
  const router = useRouter()

  // Établir la session depuis le hash de l'URL (token envoyé par Supabase)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")
      if (accessToken && refreshToken) {
        const supabase = createSupabaseBrowserClient()
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }
  }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ password }: FormValues) => {
    const pw = checkPasswordStrength(password)
    if (!pw.ok) {
      toast.error("Mot de passe trop faible", { description: pw.hint ?? "Renforcez votre mot de passe." })
      return
    }
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.updateUser({ password })
    void fetch("/api/auth/event", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: error ? "signup_fail" : "reset_ok",
        user_id: data?.user?.id,
        email: data?.user?.email,
        metadata: error ? { reason: error.message?.slice(0, 120) } : { kind: "password_reset" },
      }),
    }).catch(() => {})
    if (error) {
      toast.error("Échec", { description: error.message })
      return
    }
    toast.success("Mot de passe mis à jour")
    router.replace("/app")
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-muted">12 caractères minimum, mélangez min/maj/chiffre/spécial.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="mt-2"
            invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">Valider</Button>
      </form>
    </div>
  )
}
