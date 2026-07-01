"use client"
import { useState, useTransition, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, X, Check, Calendar } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { Card, CardTitle } from "@/components/ui/card"

type Employe = { id: string; full_name: string | null; role: string; avatar_url?: string | null }
type DevisSigne = { id: string; objet: string | null; clients: { nom: string | null; prenom: string | null; raison_sociale: string | null } | null }
type PlanningEntry = {
  id: string
  employe_id: string
  devis_id: string | null
  date: string
  date_fin: string | null
  heure_debut: string | null
  heure_fin: string | null
  titre: string
  notes: string | null
  couleur: string
  statut: string
}

const COULEURS = [
  { id: "blue", label: "Bleu", bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
  { id: "green", label: "Vert", bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
  { id: "yellow", label: "Jaune", bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800" },
  { id: "red", label: "Rouge", bg: "bg-red-100", border: "border-red-300", text: "text-red-800" },
  { id: "purple", label: "Violet", bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
  { id: "orange", label: "Orange", bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
]

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

function getMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getCouleur(id: string) {
  return COULEURS.find((c) => c.id === id) ?? COULEURS[0]
}

export function PlanningClient({
  employes,
  devisSigne,
  orgId,
  currentUserId,
  canWrite,
  canSeeAll,
}: {
  employes: Employe[]
  devisSigne: DevisSigne[]
  orgId: string
  currentUserId: string
  canWrite: boolean
  canSeeAll: boolean
}) {
  const [semaine, setSemaine] = useState(() => getMonday(new Date()))
  const [entries, setEntries] = useState<PlanningEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<{ employeId: string; date: string } | null>(null)
  const [editEntry, setEditEntry] = useState<PlanningEntry | null>(null)
  const [pending, startTransition] = useTransition()

  // Form state
  const [titre, setTitre] = useState("")
  const [heureDebut, setHeureDebut] = useState("08:00")
  const [heureFin, setHeureFin] = useState("17:00")
  const [notes, setNotes] = useState("")
  const [couleur, setCouleur] = useState("blue")
  const [devisId, setDevisId] = useState("")
  const [statut, setStatut] = useState("planifie")
  const [dateFin, setDateFin] = useState("")
  const [employesIds, setEmployesIds] = useState<string[]>([])

  const jours = Array.from({ length: 7 }, (_, i) => addDays(semaine, i))

  // Filtrer employés selon permissions
  const employesFiltres = canSeeAll
    ? employes
    : employes.filter((e) => e.id === currentUserId)

  // Recherche de tâches
  const searchResults = search.trim().length > 1
    ? entries.filter((e) => e.titre.toLowerCase().includes(search.toLowerCase()))
    : []

  useEffect(() => {
    loadEntries()
  }, [semaine])

  async function loadEntries() {
    setLoading(true)
    const debut = formatDate(semaine)
    const fin = formatDate(addDays(semaine, 6))
    const res = await fetch(`/api/planning?debut=${debut}&fin=${fin}`)
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoading(false)
  }

  function openModal(employeId: string, date: string, entry?: PlanningEntry) {
    if (!canWrite) return
    if (entry) {
      setEditEntry(entry)
      setTitre(entry.titre)
      setHeureDebut(entry.heure_debut ?? "08:00")
      setHeureFin(entry.heure_fin ?? "17:00")
      setNotes(entry.notes ?? "")
      setCouleur(entry.couleur)
      setDevisId(entry.devis_id ?? "")
      setStatut(entry.statut)
      setDateFin(entry.date_fin ?? "")
      setEmployesIds([entry.employe_id])
    } else {
      setEditEntry(null)
      setTitre("")
      setHeureDebut("08:00")
      setHeureFin("17:00")
      setNotes("")
      setCouleur("blue")
      setDevisId("")
      setStatut("planifie")
      setDateFin("")
      setEmployesIds(modal?.employeId ? [modal.employeId] : [])
    }
    setModal({ employeId, date })
  }

  function closeModal() {
    setModal(null)
    setEditEntry(null)
  }

  async function save() {
    if (!modal || !titre.trim()) return
    startTransition(async () => {
      const ids = editEntry ? [modal.employeId] : (employesIds.length > 0 ? employesIds : [modal.employeId])
      const body = {
        id: editEntry?.id,
        employe_id: modal.employeId,
        date: modal.date,
        titre: titre.trim(),
        heure_debut: heureDebut,
        heure_fin: heureFin,
        notes: notes.trim() || null,
        couleur,
        devis_id: devisId || null,
        statut,
        date_fin: dateFin || modal.date,
      }
      if (editEntry) {
        const res = await fetch("/api/planning", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (data.ok) { toast.success("Planning mis à jour"); closeModal(); loadEntries() }
        else toast.error("Erreur", { description: data.error })
      } else {
        const results = await Promise.all(ids.map((empId) =>
          fetch("/api/planning", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, employe_id: empId }),
          }).then((r) => r.json())
        ))
        const errors = results.filter((r) => !r.ok)
        if (errors.length === 0) { toast.success(`Tâche ajoutée pour ${ids.length} employé(s)`); closeModal(); loadEntries() }
        else toast.error("Erreur partielle", { description: errors[0].error })
      }
    })
  }

  async function deleteEntry(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/planning?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        toast.success("Tâche supprimée")
        closeModal()
        loadEntries()
      } else {
        toast.error("Erreur")
      }
    })
  }

  const entriesForCell = (employeId: string, date: string) =>
    entries.filter((e) => {
      if (e.employe_id !== employeId) return false
      const debut = e.date
      const fin = e.date_fin ?? e.date
      return date >= debut && date <= fin
    })

  const semaineLabel = `${jours[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — ${jours[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`

  return (
    <div className="max-w-full mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <CardTitle>Planning équipe</CardTitle>
          <p className="text-sm text-muted mt-1">{semaineLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setSemaine(getMonday(new Date()))}>
            <Calendar className="h-4 w-4" /> Aujourd&apos;hui
          </Button>
          <Button variant="secondary" onClick={() => setSemaine((s) => addDays(s, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setSemaine((s) => addDays(s, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="mb-4 relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une tâche..."
          className="w-full h-10 rounded-xl border border-border bg-surface px-4 pr-10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-electric"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-muted hover:text-foreground">✕</button>
        )}
      </div>

      {/* Résultats de recherche */}
      {search.trim().length > 1 && (
        <div className="mb-4 space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-sm text-muted p-3">Aucune tâche trouvée</div>
          ) : (
            searchResults.map((entry) => {
              const emp = employes.find((e) => e.id === entry.employe_id)
              const c = getCouleur(entry.couleur)
              return (
                <button
                  key={entry.id}
                  onClick={() => openModal(entry.employe_id, entry.date, entry)}
                  className={`w-full text-left rounded-xl px-3 py-2 border ${c.bg} ${c.border} ${c.text}`}
                >
                  <div className="font-semibold text-sm">{entry.titre}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {emp?.full_name ?? "?"} · {new Date(entry.date).toLocaleDateString("fr-FR")}
                    {entry.heure_debut && ` · ${entry.heure_debut.slice(0,5)}`}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* Debug */}
      {employes.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          Aucun employé trouvé dans votre organisation.
        </div>
      )}
      {/* Grille */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs text-muted font-medium w-32 border-b border-border">Employé</th>
              {jours.map((jour, i) => {
                const isToday = formatDate(jour) === formatDate(new Date())
                return (
                  <th key={i} className={`py-2 px-2 text-center text-xs font-medium border-b border-border ${isToday ? "text-electric" : "text-muted"}`}>
                    <div>{JOURS[i]}</div>
                    <div className={`text-base font-bold ${isToday ? "text-electric" : "text-foreground"}`}>
                      {jour.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {employesFiltres.map((emp) => (
              <tr key={emp.id} className="border-b border-border/50">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-electric/10 flex items-center justify-center text-electric font-bold text-sm shrink-0">
                      {(emp.full_name?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="text-sm font-medium truncate max-w-[80px]">
                      {emp.full_name ?? "Employé"}
                    </div>
                  </div>
                </td>
                {jours.map((jour, i) => {
                  const dateStr = formatDate(jour)
                  const cellEntries = entriesForCell(emp.id, dateStr)
                  return (
                    <td key={i} className="py-1 px-1 align-top min-w-[100px]">
                      <div className="min-h-[60px] space-y-1">
                        {cellEntries.map((entry) => {
                          const c = getCouleur(entry.couleur)
                          return (
                            <button
                              key={entry.id}
                              onClick={() => openModal(emp.id, dateStr, entry)}
                              className={`w-full text-left rounded-lg px-2 py-1 text-xs border ${c.bg} ${c.border} ${c.text} hover:opacity-80 transition-opacity`}
                            >
                              <div className="font-semibold truncate">{entry.titre}</div>
                              {entry.heure_debut && (
                                <div className="opacity-70">{entry.heure_debut.slice(0, 5)}–{entry.heure_fin?.slice(0, 5)}</div>
                              )}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => openModal(emp.id, dateStr)}
                          className="w-full h-6 rounded border border-dashed border-border/50 hover:border-electric/50 hover:bg-electric/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100"
                        >
                          <Plus className="h-3 w-3 text-muted" />
                        </button>
                        {cellEntries.length === 0 && canWrite && (
                          <button
                            onClick={() => openModal(emp.id, dateStr)}
                            className="w-full h-[52px] rounded border border-dashed border-border/40 hover:border-electric/50 hover:bg-electric/5 transition-colors flex items-center justify-center"
                          >
                            <Plus className="h-4 w-4 text-muted/60" />
                          </button>
                        )}
                        {cellEntries.length > 0 && canWrite && (
                          <button
                            onClick={() => openModal(emp.id, dateStr)}
                            className="w-full h-6 rounded border border-dashed border-border/40 hover:border-electric/50 hover:bg-electric/5 transition-colors flex items-center justify-center"
                          >
                            <Plus className="h-3 w-3 text-muted/60" />
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display font-semibold">{editEntry ? "Modifier la tâche" : "Nouvelle tâche"}</h3>
              <button onClick={closeModal} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <Label>Titre *</Label>
                <Input className="mt-2" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Pose prises salon" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Début</Label>
                  <Input className="mt-2" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input className="mt-2" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Date de fin</Label>
<Input className="mt-2" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} min={modal?.date ?? ""} />
                <p className="text-xs text-muted mt-1">Laisser vide si même jour</p>
              </div>
              <div>
                <Label>Chantier associé</Label>
                <select
                  className="mt-2 flex h-11 w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm"
                  value={devisId}
                  onChange={(e) => {
                    setDevisId(e.target.value)
                    if (e.target.value && !titre) {
                      const d = devisSigne.find((d) => d.id === e.target.value)
                      if (d) setTitre(d.objet ?? "Chantier")
                    }
                  }}
                >
                  <option value="">— Aucun chantier —</option>
                  {devisSigne.map((d) => {
                    const c = d.clients
                    const clientName = c ? (c.raison_sociale ?? [c.prenom, c.nom].filter(Boolean).join(" ")) : ""
                    return (
                      <option key={d.id} value={d.id}>
                        {d.objet ?? "Sans objet"} {clientName ? `· ${clientName}` : ""}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <Label>Statut</Label>
                <select
                  className="mt-2 flex h-11 w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm"
                  value={statut}
                  onChange={(e) => setStatut(e.target.value)}
                >
                  <option value="planifie">📅 Planifié</option>
                  <option value="en_cours">🔧 En cours</option>
                  <option value="termine">✅ Terminé</option>
                  <option value="annule">❌ Annulé</option>
                </select>
              </div>
              <div>
                <Label>Couleur</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {COULEURS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCouleur(c.id)}
                      className={`h-8 w-8 rounded-full border-2 ${c.bg} ${couleur === c.id ? "border-foreground" : "border-transparent"}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <textarea
                  className="mt-2 flex min-h-[80px] w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Infos supplémentaires..."
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-5 border-t border-border gap-3">
              {editEntry ? (
                <Button variant="secondary" onClick={() => deleteEntry(editEntry.id)} disabled={pending}>
                  Supprimer
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button onClick={save} disabled={pending || !titre.trim()}>
                  <Check className="h-4 w-4" /> {editEntry ? "Mettre à jour" : "Ajouter"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
