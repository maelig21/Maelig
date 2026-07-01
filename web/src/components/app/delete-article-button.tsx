"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteArticleButton({ articleId }: { articleId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function remove() {
    startTransition(async () => {
      const res = await fetch(`/api/catalogue/${articleId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        toast.success("Article supprimé")
        router.refresh()
      } else {
        toast.error("Erreur", { description: data.error })
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={remove} disabled={pending} className="text-xs text-red-500 hover:underline disabled:opacity-50">
          {pending ? "..." : "Confirmer"}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-muted hover:underline ml-1">
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirm(true)} className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
