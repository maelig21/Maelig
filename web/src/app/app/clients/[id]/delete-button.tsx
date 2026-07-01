"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function remove() {
    startTransition(async () => {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        toast.success("Client supprimé")
        router.push("/app/clients")
      } else {
        toast.error("Erreur", { description: data.error })
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Supprimer {clientName} ?</span>
        <Button variant="secondary" onClick={remove} disabled={pending} className="text-red-500 border-red-200 hover:bg-red-50">
          {pending ? "..." : "Confirmer"}
        </Button>
        <Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setConfirm(true)} className="text-red-500 border-red-200 hover:bg-red-50">
      <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Supprimer</span>
    </Button>
  )
}
