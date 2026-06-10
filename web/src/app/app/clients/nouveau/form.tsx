"use client"
import { useRouter } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input, Label, Textarea } from "@/components/ui/input"
import { saveClient, getClient } from "@/lib/actions/clients"

type ClientFormData = {
  nom: string; prenom: string; raison_sociale: string; email: string; telephone: string
  adresse: string; cp: string; ville: string; notes: string
}

export default function NouveauClientForm({ clientId }: { clientId?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(!!clientId)
  const [form, setForm] = useState<ClientFormData>({
    nom: "", prenom: "", raison_sociale: "", email: "", telephone: "",
    adresse: "", cp: "", ville: "", notes: "",
  })

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getClient(clientId).then((client) => {
      if (client) {
        setForm({
          nom: client.nom ?? "",
          prenom: client.prenom ?? "",
          raison_sociale: client.raison_sociale ?? "",
          email: client.email ?? "",
          telephone: client.telephone ?? "",
          adresse: client.adresse ?? "",
          cp: client.cp ?? "",
          ville: client.ville ?? "",
          notes: client.notes ?? "",
        })
      } else {
        toast.error("Client introuvable")
      }
    }).catch((e) => {
      toast.error("Erreur", { description: e instanceof Error ? e.message : String(e) })
    }).finally(() => setLoading(false))
  }, [clientId])

  const set = (k: keyof ClientFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function submit() {
    if (!form.nom) { toast.error("Le nom est obligatoire"); return }
    startTransition(async () => {
      try {
        await saveClient({ ...form, ...(clientId ? { id: clientId } : {}) })
        toast.success(clientId ? "Client modifié" : "Client enregistré")
        router.push("/app/clients")
      } catch (e) {
        toast.error("Erreur", { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
        <p className="text-muted text-sm">Chargement des informations du client...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
      <Link href="/app/clients" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
        <ArrowLeft className="h-3 w-3" /> Clients
      </Link>
      <CardTitle>{clientId ? "Modifier le client" : "Nouveau client"}</CardTitle>
      <Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Nom *</Label><Input className="mt-2" value={form.nom} onChange={set("nom")} /></div>
          <div><Label>Prénom</Label><Input className="mt-2" value={form.prenom} onChange={set("prenom")} /></div>
          <div className="sm:col-span-2"><Label>Société (si pro)</Label><Input className="mt-2" value={form.raison_sociale} onChange={set("raison_sociale")} /></div>
          <div><Label>Email</Label><Input className="mt-2" type="email" value={form.email} onChange={set("email")} /></div>
          <div><Label>Téléphone</Label><Input className="mt-2" type="tel" value={form.telephone} onChange={set("telephone")} /></div>
          <div className="sm:col-span-2"><Label>Adresse</Label><Input className="mt-2" value={form.adresse} onChange={set("adresse")} /></div>
          <div><Label>Code postal</Label><Input className="mt-2" value={form.cp} onChange={set("cp")} /></div>
          <div><Label>Ville</Label><Input className="mt-2" value={form.ville} onChange={set("ville")} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-2" rows={3} value={form.notes} onChange={set("notes")} /></div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button loading={pending} onClick={submit}>{clientId ? "Modifier" : "Enregistrer"}</Button>
          <Button variant="ghost" onClick={() => router.back()}>Annuler</Button>
        </div>
      </Card>
    </div>
  )
}
