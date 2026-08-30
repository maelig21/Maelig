"use client"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"

export function SuperPdpForm({
  isOwner,
  initialClientId,
  hasSecret,
  initialActive,
}: {
  isOwner: boolean
  initialClientId: string
  hasSecret: boolean
  initialActive: boolean
}) {
  const [clientId, setClientId] = useState(initialClientId)
  const [clientSecret, setClientSecret] = useState("")
  const [electronicAddress, setElectronicAddress] = useState("")
  const [active, setActive] = useState(initialActive)
  const [pending, startTransition] = useTransition()

  function save() {
    if (!clientId.trim()) {
      toast.error("Le Client ID est requis")
      return
    }
    startTransition(async () => {
      const res = await fetch("/api/parametres/superpdp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim() || undefined,
          electronic_address: electronicAddress.trim() || undefined,
          active,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Connexion Super PDP enregistrée !")
        setClientSecret("")
      } else {
        toast.error("Erreur", { description: data.error })
      }
    })
  }

  if (!isOwner) {
    return <p className="text-sm text-warning">Seul le propriétaire peut configurer cette connexion.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="client_id">Client ID</Label>
        <Input
          id="client_id"
          className="mt-2 font-mono text-sm"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="ex: 01a05488-4f32-7839-81b4-186d492bc7d7"
        />
      </div>
      <div>
        <Label htmlFor="client_secret">Client Secret {hasSecret && <span className="text-muted font-normal">(déjà enregistré — laissez vide pour ne pas changer)</span>}</Label>
        <Input
          id="client_secret"
          type="password"
          className="mt-2 font-mono text-sm"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={hasSecret ? "••••••••••••••••" : "Collez votre client_secret"}
        />
      </div>
      <div>
        <Label htmlFor="electronic_address">Adresse électronique Peppol <span className="text-muted font-normal">(optionnel — affichée dans votre annuaire Super PDP)</span></Label>
        <Input
          id="electronic_address"
          className="mt-2 font-mono text-sm"
          value={electronicAddress}
          onChange={(e) => setElectronicAddress(e.target.value)}
          placeholder="ex: 0225:123456789_12345"
        />
      </div>

      <label className="flex items-center justify-between p-3 rounded-xl border border-border cursor-pointer">
        <div>
          <div className="text-sm font-medium">Activer la transmission automatique</div>
          <div className="text-xs text-muted mt-0.5">Vos factures seront transmises à Super PDP dès leur émission</div>
        </div>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="accent-electric h-5 w-5"
        />
      </label>

      <Button onClick={save} disabled={pending} className="w-full sm:w-auto">
        {pending ? "Enregistrement..." : "Enregistrer la connexion"}
      </Button>
    </div>
  )
}
