"use client"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FactureActions({ factureId, statut, devisId, facturationElectroniqueActive, superpdpId }: { factureId: string; statut: string; devisId?: string; facturationElectroniqueActive?: boolean; superpdpId?: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function call(fn: () => Promise<void>, msg: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(msg)
        router.refresh()
      } catch (e) {
        toast.error("Erreur", { description: e instanceof Error ? e.message : "Erreur inconnue" })
      }
    })
  }

  async function marquerPayee() {
    const res = await fetch(`/api/factures/${factureId}/payer`, { method: "POST" })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
  }

  async function marquerAbandonnee() {
    const res = await fetch(`/api/factures/${factureId}/abandonner`, { method: "POST" })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
  }

  async function transmettre() {
    const res = await fetch(`/api/factures/${factureId}/transmettre`, { method: "POST" })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? "Erreur transmission")
  }

  if (statut === "payee") {
    return (
      <div className="inline-flex items-center gap-2 text-green-600 font-medium">
        <Check className="h-4 w-4" /> Facture encaissée
      </div>
    )
  }

  if (statut === "abandonnee") {
    return (
      <div className="inline-flex items-center gap-2 text-gray-400 font-medium">
        <X className="h-4 w-4" /> Facture abandonnée
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => call(marquerPayee, "Facture marquée comme payée !")} disabled={pending}>
        <Check className="h-4 w-4" /> Marquer comme payée
      </Button>
      <Button variant="secondary" asChild>
        <a href={`/api/factures/${factureId}/facturx`} download title="Format conforme réforme facturation électronique 2027">
          📄 Télécharger Factur-X
        </a>
      </Button>
      {facturationElectroniqueActive && (
        superpdpId ? (
          <div className="inline-flex items-center gap-2 text-green-600 text-sm font-medium px-3">
            <Check className="h-4 w-4" /> Transmise (réf. {superpdpId})
          </div>
        ) : (
          <Button variant="secondary" onClick={() => call(transmettre, "Facture transmise à la plateforme agréée !")} disabled={pending}>
            ⚡ Transmettre (Super PDP)
          </Button>
        )
      )}
      <Button variant="secondary" onClick={() => call(marquerAbandonnee, "Facture abandonnée")} disabled={pending}>
        <X className="h-4 w-4" /> Abandonner
      </Button>
      {devisId && (
        <Button variant="secondary" asChild>
          <a href={`/app/devis/${devisId}`}>Voir le devis</a>
        </Button>
      )}
    </div>
  )
}
