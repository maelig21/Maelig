"use client"
import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { Card, CardTitle } from "@/components/ui/card"

type Settings = {
  couleur: string
  police: string
  logo_taille: "petit" | "moyen" | "grand"
  logo_position: "gauche" | "centre" | "droite"
  header_disposition: "logo-gauche-infos-droite" | "logo-droite-infos-gauche" | "centre"
  afficher_siret: boolean
  afficher_tel: boolean
  afficher_email: boolean
  afficher_rib: boolean
  client_position: "gauche" | "droite"
  tableau_style: "lignes" | "alternees" | "minimal"
  marges: "petites" | "normales" | "grandes"
  couleur_secondaire: string
  afficher_logo: boolean
}

const DEFAULT_SETTINGS: Settings = {
  couleur: "#1e40af",
  police: "Inter",
  logo_taille: "moyen",
  logo_position: "gauche",
  header_disposition: "logo-gauche-infos-droite",
  afficher_siret: true,
  afficher_tel: true,
  afficher_email: true,
  afficher_rib: true,
  client_position: "droite",
  tableau_style: "lignes",
  marges: "normales",
  couleur_secondaire: "#f4f4f5",
  afficher_logo: true,
}

const LOGO_TAILLES = { petit: "h-8", moyen: "h-14", grand: "h-20" }
const MARGES = { petites: "p-4", normales: "p-8", grandes: "p-12" }
const POLICES = ["Inter", "Plus Jakarta Sans", "Geist", "Merriweather", "Courier Prime"]

export function AppearanceEditor({
  orgId,
  orgNom,
  orgLogoUrl,
  initialSettings,
}: {
  orgId: string
  orgNom: string
  orgLogoUrl: string | null
  initialSettings: Partial<Settings>
}) {
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS, ...initialSettings })
  const [pending, startTransition] = useTransition()

  function update(key: keyof Settings, value: Settings[keyof Settings]) {
    setS((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/parametres/apparence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, settings: s }),
      })
      const data = await res.json()
      if (data.ok) toast.success("Apparence sauvegardée !")
      else toast.error("Erreur", { description: data.error })
    })
  }

  const margePx = MARGES[s.marges]
  const logoSize = LOGO_TAILLES[s.logo_taille]

  return (
    <div className="max-w-full mx-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/parametres" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
            <ArrowLeft className="h-3 w-3" /> Paramètres
          </Link>
          <CardTitle>Apparence du devis</CardTitle>
        </div>
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" /> Sauvegarder
        </Button>
      </div>

      <div className="flex gap-0 h-[calc(100vh-64px)]">
        {/* Panneau gauche : options */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-4 space-y-5">

          {/* Couleurs */}
          <Card>
            <h3 className="font-semibold mb-3">🎨 Couleurs</h3>
            <div className="space-y-3">
              <div>
                <Label>Couleur principale</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.couleur} onChange={(e) => update("couleur", e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                  <Input value={s.couleur} onChange={(e) => update("couleur", e.target.value)} className="font-mono text-sm h-8 w-28" />
                </div>
              </div>
              <div>
                <Label>Couleur de fond tableau</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.couleur_secondaire} onChange={(e) => update("couleur_secondaire", e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                  <Input value={s.couleur_secondaire} onChange={(e) => update("couleur_secondaire", e.target.value)} className="font-mono text-sm h-8 w-28" />
                </div>
              </div>
            </div>
          </Card>

          {/* Police */}
          <Card>
            <h3 className="font-semibold mb-3">✏️ Police</h3>
            <select value={s.police} onChange={(e) => update("police", e.target.value)} className="w-full h-9 rounded border border-border bg-surface px-3 text-sm">
              {POLICES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Card>

          {/* Logo */}
          <Card>
            <h3 className="font-semibold mb-3">🖼️ Logo</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={s.afficher_logo} onChange={(e) => update("afficher_logo", e.target.checked)} className="accent-electric" />
                <Label>Afficher le logo</Label>
              </div>
              {s.afficher_logo && (
                <>
                  <div>
                    <Label>Taille</Label>
                    <div className="flex gap-2 mt-1">
                      {(["petit", "moyen", "grand"] as const).map((t) => (
                        <button key={t} onClick={() => update("logo_taille", t)} className={`flex-1 py-1 rounded text-xs border ${s.logo_taille === t ? "bg-electric text-black border-electric" : "border-border text-muted"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Disposition */}
          <Card>
            <h3 className="font-semibold mb-3">📐 Disposition en-tête</h3>
            <div className="space-y-2">
              {([
                { value: "logo-gauche-infos-droite", label: "Logo ← | Infos →" },
                { value: "logo-droite-infos-gauche", label: "Infos ← | Logo →" },
                { value: "centre", label: "Centré" },
              ] as const).map((opt) => (
                <button key={opt.value} onClick={() => update("header_disposition", opt.value)} className={`w-full py-2 px-3 rounded text-xs border text-left ${s.header_disposition === opt.value ? "bg-electric text-black border-electric" : "border-border text-muted"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Infos à afficher */}
          <Card>
            <h3 className="font-semibold mb-3">ℹ️ Informations entreprise</h3>
            <div className="space-y-2">
              {([
                { key: "afficher_siret", label: "SIRET" },
                { key: "afficher_tel", label: "Téléphone" },
                { key: "afficher_email", label: "Email" },
                { key: "afficher_rib", label: "RIB / IBAN" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={s[key] as boolean} onChange={(e) => update(key, e.target.checked)} className="accent-electric" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Tableau */}
          <Card>
            <h3 className="font-semibold mb-3">📋 Style tableau</h3>
            <div className="space-y-2">
              {([
                { value: "lignes", label: "Lignes simples" },
                { value: "alternees", label: "Lignes alternées" },
                { value: "minimal", label: "Minimal (pas de bordures)" },
              ] as const).map((opt) => (
                <button key={opt.value} onClick={() => update("tableau_style", opt.value)} className={`w-full py-2 px-3 rounded text-xs border text-left ${s.tableau_style === opt.value ? "bg-electric text-black border-electric" : "border-border text-muted"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Marges */}
          <Card>
            <h3 className="font-semibold mb-3">📏 Marges</h3>
            <div className="flex gap-2">
              {(["petites", "normales", "grandes"] as const).map((m) => (
                <button key={m} onClick={() => update("marges", m)} className={`flex-1 py-1 rounded text-xs border ${s.marges === m ? "bg-electric text-black border-electric" : "border-border text-muted"}`}>
                  {m}
                </button>
              ))}
            </div>
          </Card>

        </div>

        {/* Aperçu temps réel */}
        <div className="flex-1 bg-gray-100 overflow-auto p-6">
          <div className="text-xs text-center text-gray-400 mb-3">Aperçu en temps réel</div>
          <div
            className="bg-white shadow-xl rounded-lg overflow-hidden max-w-2xl mx-auto"
            style={{ fontFamily: s.police }}
          >
            {/* Bande couleur */}
            <div className="h-2" style={{ backgroundColor: s.couleur }} />

            <div className={margePx}>
              {/* En-tête */}
              <div className={`flex ${s.header_disposition === "logo-droite-infos-gauche" ? "flex-row-reverse" : s.header_disposition === "centre" ? "flex-col items-center" : "flex-row"} items-start justify-between gap-4 mb-6`}>
                {/* Logo / Nom entreprise */}
                <div className={s.header_disposition === "centre" ? "text-center" : ""}>
                  {s.afficher_logo && orgLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={orgLogoUrl} alt="Logo" className={`${logoSize} object-contain`} />
                  ) : (
                    <div className="text-xl font-bold text-gray-800">{orgNom}</div>
                  )}
                </div>

                {/* Infos devis */}
                <div className={s.header_disposition === "centre" ? "text-center mt-2" : "text-right"}>
                  <div className="text-2xl font-bold text-gray-900">DEVIS</div>
                  <div className="text-xs text-gray-400 mt-1">N° DEP-XXXXXXXX</div>
                  <div className="text-xs text-gray-400">Date : {new Date().toLocaleDateString("fr-FR")}</div>
                  <div className="mt-3 text-sm text-gray-700">
                    <div className="font-semibold">Jean Dupont</div>
                    <div className="text-xs text-gray-500">12 rue des Lilas, Paris</div>
                  </div>
                </div>
              </div>

              {/* Infos entreprise */}
              <div className="text-xs text-gray-500 mb-4 space-y-0.5">
                <div className="font-semibold text-gray-700">{orgNom}</div>
                <div>12 rue de la Paix, 75001 Paris</div>
                {s.afficher_siret && <div>SIRET : 123 456 789 00012</div>}
                {s.afficher_tel && <div>Tél : 06 12 34 56 78</div>}
                {s.afficher_email && <div>Email : contact@entreprise.fr</div>}
              </div>

              {/* Objet */}
              <div className="border-l-4 pl-3 mb-4" style={{ borderColor: s.couleur }}>
                <div className="text-xs text-gray-400 uppercase">Objet</div>
                <div className="font-semibold text-gray-800">Installation électrique salon</div>
              </div>

              {/* Tableau */}
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr style={{ backgroundColor: s.couleur, color: "white" }}>
                    <th className="text-left py-2 px-3">Désignation</th>
                    <th className="text-right py-2 px-2">Qté</th>
                    <th className="text-right py-2 px-2">PU HT</th>
                    <th className="text-right py-2 px-3">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { desc: "Prise 16A étanche IP44", qty: 3, pu: 9.00, total: 27.00 },
                    { desc: "Interrupteur va-et-vient", qty: 2, pu: 5.00, total: 10.00 },
                    { desc: "Câble 2.5mm² RO2V", qty: 15, pu: 1.80, total: 27.00 },
                  ].map((row, i) => (
                    <tr key={i} style={{
                      backgroundColor: s.tableau_style === "alternees" && i % 2 === 1 ? s.couleur_secondaire :
                        s.tableau_style === "minimal" ? "transparent" : "white",
                      borderBottom: s.tableau_style === "minimal" ? "none" : "1px solid #f0f0f0"
                    }}>
                      <td className="py-1.5 px-3 text-gray-700">{row.desc}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{row.qty}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{row.pu.toFixed(2)} €</td>
                      <td className="py-1.5 px-3 text-right font-medium text-gray-800">{row.total.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totaux */}
              <div className="flex justify-end mb-4">
                <div className="w-48 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600"><span>Total HT</span><span>64,00 €</span></div>
                  <div className="flex justify-between text-gray-600"><span>TVA 20%</span><span>12,80 €</span></div>
                  <div className="flex justify-between font-bold text-sm border-t pt-1" style={{ color: s.couleur }}>
                    <span>Total TTC</span><span>76,80 €</span>
                  </div>
                </div>
              </div>

              {/* RIB */}
              {s.afficher_rib && (
                <div className="text-xs text-gray-400 border-t pt-3">
                  <div className="font-semibold text-gray-600">Règlement par virement :</div>
                  <div>IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
