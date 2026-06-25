"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { toast } from "sonner"

export default function AccepterInvitationPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Supabase injecte le token dans le hash de l'URL
    const hash = window.location.hash
    if (hash.includes("access_token") || hash.includes("type=invite")) {
      setReady(true)
    } else {
      // Peut-être déjà connecté via le lien
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true)
        else router.push("/connexion")
      })
    }
  }, [])

  async function submit() {
    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères")
      return
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error("Erreur", { description: error.message })
      setPending(false)
      return
    }
    toast.success("Bienvenue sur DEP ! 🎉")
    router.push("/app")
  }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted text-sm">Chargement...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">⚡ DEP</div>
          <div className="text-sm text-gray-500 mt-1">Devis et gestion d&apos;entreprise</div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bienvenue !</h1>
          <p className="text-sm text-gray-500 mt-1">
            Votre patron vous a invité sur DEP. Créez votre mot de passe pour accéder à votre compte.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Mot de passe</Label>
            <Input
              type="password"
              className="mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
            />
          </div>
          <div>
            <Label>Confirmer le mot de passe</Label>
            <Input
              type="password"
              className="mt-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Répétez le mot de passe"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? "Création..." : "Créer mon compte et accéder à DEP"}
          </Button>
        </div>
      </div>
    </div>
  )
}
