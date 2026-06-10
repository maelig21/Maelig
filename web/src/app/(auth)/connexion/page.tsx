"use client"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowRight, KeyRound, Mail } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input, Label, FieldError } from "@/components/ui/input"

// P1 audit 2026-05-20 — Pas de min(12) sur LOGIN : on ne veut pas
// bloquer les comptes créés avant le hardening. Mais on garde min(8) côté UX
// pour signaler une saisie clairement incomplète.
const schema = z.object({
  email: z.string().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
})

type FormValues = z.infer<typeof schema>

export default function ConnexionPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Bon retour.</h1>
      <p className="mt-2 text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-electric hover:underline">
          Démarrez vos 14 jours gratuits
        </Link>
      </p>

      <Suspense fallback={<div className="mt-8 text-sm text-muted">Chargement du formulaire…</div>}>
        <ConnexionInner />
      </Suspense>
    </div>
  )
}

function ConnexionInner() {
  const router = useRouter()
  const params = useSearchParams()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (data: FormValues) => {
    // P1-1 audit : pré-flight rate limit anti credential stuffing (IP + email)
    const pre = await fetch("/api/auth/preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", email: data.email }),
    })
    if (pre.status === 429 || pre.status === 423) {
      const reason = pre.status === 423
        ? "Compte verrouillé 15 min après 5 tentatives échouées."
        : "Trop de tentatives. Attendez 15 minutes."
      toast.error("Accès bloqué", { description: reason })
      return
    }
    const supabase = createSupabaseBrowserClient()
    const { data: signIn, error } = await supabase.auth.signInWithPassword(data)
    // Audit log (best-effort, fail-soft)
    void fetch("/api/auth/event", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: error ? "login_fail" : "login_ok",
        email: data.email,
        user_id: signIn?.user?.id,
        metadata: error ? { reason: error.message?.slice(0, 120) } : undefined,
      }),
    }).catch(() => {})
    if (error) {
      toast.error("Connexion impossible", { description: error.message })
      return
    }
    toast.success("Bienvenue 👋")
    router.replace(params.get("redirect_to") ?? "/app")
  }

  return (
    <div className="mt-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-2">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.fr"
              className="pl-9"
              invalid={!!errors.email}
              {...register("email")}
            />
          </div>
          <FieldError>{errors.email?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative mt-2">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="pl-9"
              invalid={!!errors.password}
              {...register("password")}
            />
          </div>
          <FieldError>{errors.password?.message}</FieldError>
          <Link href="/oubli" className="mt-2 inline-block text-xs text-muted hover:text-electric">
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full" iconRight={<ArrowRight className="h-4 w-4" />}>
          Se connecter
        </Button>
      </form>
    </div>
  )
}
