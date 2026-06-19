"use client"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function SavedToast() {
  const params = useSearchParams()
  useEffect(() => {
    if (params.get("ok") === "1") {
      toast.success("Informations sauvegardées !")
    }
  }, [params])
  return null
}
