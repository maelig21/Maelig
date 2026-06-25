"use client"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { inviteSlave } from "@/lib/actions/team"
import { getLanguageOptions } from "@/lib/langues"

export function InviteForm() {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    telephone: "",
    langue_maternelle: "fr",
    titre_poste: "",
  })

  function submit() {
    if (!form.email || !form.full_name) {
      toast.error("Email et nom requis")
      return
    }
    startTransition(async () => {
      try {
        await inviteSlave(form)
        toast.success("Invitation envoyée 📨", { description: form.email })
        setForm({ email: "", full_name: "", telephone: "", langue_maternelle: "fr", titre_poste: "" })
      } catch (e) {
        toast.error("Erreur", { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-3">
      <div>
        <Label>Nom complet</Label>
        <Input className="mt-2" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Moussa Diallo" />
      </div>
      <div>
        <Label>Email pro</Label>
        <Input type="email" className="mt-2" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="moussa@…" />
      </div>
      <div>
        <Label>Téléphone direct</Label>
        <Input type="tel" className="mt-2" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} placeholder="06 12 34 56 78" />
      </div>
      <div>
        <Label>Titre poste</Label>
        <Input className="mt-2" value={form.titre_poste} onChange={(e) => setForm((f) => ({ ...f, titre_poste: e.target.value }))} placeholder="Électricien · Apprenti…" />
      </div>
      <div className="sm:col-span-2">
        <Label>Langue maternelle (pour traduction auto)</Label>
        <select
          className="mt-2 flex h-11 w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm"
          value={form.langue_maternelle}
          onChange={(e) => setForm((f) => ({ ...f, langue_maternelle: e.target.value }))}
        >
          {getLanguageOptions().map(({ group, items }) => (
            <optgroup key={group} label={group}>
              {items.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name_fr} · {l.native}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          Chaque message qu&apos;il envoie sera traduit en français pour vous. Vos messages, traduits dans sa langue pour lui.
        </p>
      </div>
      <div className="sm:col-span-2">
        <Button loading={pending} onClick={submit}>Envoyer l&apos;invitation</Button>
      </div>
    </div>
  )
}

const PERMISSIONS = [
  { id: "devis_create", label: "Créer des devis" },
  { id: "devis_prix", label: "Modifier les prix" },
  { id: "planning_write", label: "Modifier le planning" },
  { id: "planning_read_all", label: "Voir le planning de toute l'équipe" },
  { id: "incidents_read", label: "Voir les problèmes chantier" },
  { id: "catalogue_write", label: "Modifier le catalogue" },
]

export function PermissionsEditor({ memberId, permissions }: { memberId: string; permissions: Record<string, boolean> }) {
  const [perms, setPerms] = useState<Record<string, boolean>>(permissions)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggle(id: string) {
    setPerms((p) => ({ ...p, [id]: !p[id] }))
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/membres/${memberId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      })
      const data = await res.json()
      if (data.ok) setSaved(true)
      else toast.error("Erreur sauvegarde permissions")
    })
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Permissions</div>
      <div className="space-y-2">
        {PERMISSIONS.map((p) => (
          <label key={p.id} className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-sm">{p.label}</span>
            <button
              onClick={() => toggle(p.id)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${perms[p.id] ? "bg-electric" : "bg-border"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${perms[p.id] ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="mt-3 text-xs text-electric hover:underline disabled:opacity-50"
      >
        {saved ? "✓ Sauvegardé" : "Sauvegarder"}
      </button>
    </div>
  )
}

export function RemoveButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  function remove() {
    startTransition(async () => {
      const { removeSlave } = await import("@/lib/actions/team")
      try {
        await removeSlave(memberId)
        toast.success(`${memberName} retiré de l'équipe`)
      } catch (e) {
        toast.error("Erreur", { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Confirmer ?</span>
        <button onClick={remove} disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
          {pending ? "Suppression..." : "Oui, retirer"}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-muted hover:underline">Annuler</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirm(true)} className="text-xs text-red-500 hover:underline">
      Retirer de l&apos;équipe
    </button>
  )
}
