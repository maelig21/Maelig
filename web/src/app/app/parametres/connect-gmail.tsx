"use client"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function ConnectGmailButton({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition()

  function connect() {
    startTransition(async () => {
      const res = await fetch("/api/mail/connect", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error("Erreur", { description: data.error ?? "Impossible de connecter Gmail" })
    })
  }

  return (
    <Button onClick={connect} loading={pending} variant={connected ? "secondary" : "default"}>
      {connected ? "Reconnecter" : "Connecter Gmail"}
    </Button>
  )
}
