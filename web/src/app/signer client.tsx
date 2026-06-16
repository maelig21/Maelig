"use client"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignerClient({ devisId, dejaSigné }: { devisId: string; dejaSigné: boolean }) {
  const [signé, setSigné] = useState(dejaSigné)
  const [pending, startTransition] = useTransition()

  function signer() {
    startTransition(async () => {
      const res = await fetch(`/api/devis/${devisId}/signer`, { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setSigné(true)
        toast.success("Devis signé ! Merci.")
      } else {
        toast.error("Erreur", { description: data.error ?? "Impossible de signer" })
      }
    })
  }

  if (signé) {
    return (
      <div className="bg-white rounded-2xl border border-green-200 p-8 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-xl font-bold text-gray-900">Devis signé ✓</div>
        <div className="text-sm text-gray-500">Merci ! Votre artisan a été notifié et va vous recontacter rapidement.</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4">
      <div className="text-lg font-bold text-gray-900">Signer ce devis</div>
      <div className="text-sm text-gray-500">
        En cliquant sur le bouton ci-dessous, vous acceptez ce devis et autorisez votre artisan à démarrer les travaux.
      </div>
      <Button onClick={signer} disabled={pending} className="w-full sm:w-auto px-8">
        {pending ? "Signature en cours..." : "✍️ Accepter et signer ce devis"}
      </Button>
      <div className="text-xs text-gray-400">Signature électronique — valeur juridique reconnue</div>
    </div>
  )
}
