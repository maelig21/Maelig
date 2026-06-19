import Link from "next/link"
import { ArrowLeft, Save, Building2, Landmark, FileText, MapPin, Wrench } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardTitle } from "@/components/ui/card"
import { Input, Label, FieldError } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

const METIERS = [
  { id: "electricite", label: "⚡ Électricité" },
  { id: "plomberie", label: "🔧 Plomberie" },
  { id: "chauffage", label: "🔥 Chauffage / CVC" },
  { id: "climatisation", label: "❄️ Climatisation" },
  { id: "maconnerie", label: "🧱 Maçonnerie" },
  { id: "charpente", label: "🪵 Charpente / Couverture" },
  { id: "menuiserie", label: "🚪 Menuiserie / Fenêtres" },
  { id: "peinture", label: "🎨 Peinture / Revêtements" },
  { id: "carrelage", label: "🏠 Carrelage / Sol" },
  { id: "isolation", label: "🌡️ Isolation" },
  { id: "alarme", label: "🔒 Alarme / Sécurité" },
  { id: "autre", label: "🔨 Autre" },
]

async function saveSociete(formData: FormData) {
  "use server"
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  if (!profile?.org_id || (profile.role !== "owner" && profile.role !== "admin_dep")) return

  const data = {
    nom: formData.get("nom") as string,
    siret: formData.get("siret") as string,
    forme_juridique: formData.get("forme_juridique") as string,
    capital_social: formData.get("capital_social") as string,
    tva_intracommunautaire: formData.get("tva_intracommunautaire") as string,
    rcs: formData.get("rcs") as string,
    adresse: formData.get("adresse") as string,
    ville: formData.get("ville") as string,
    cp: formData.get("cp") as string,
    pays: formData.get("pays") as string,
    tel: formData.get("tel") as string,
    email: formData.get("email") as string,
    iban: formData.get("iban") as string,
    bic: formData.get("bic") as string,
    conditions_reglement: formData.get("conditions_reglement") as string,
    couleur_principale: formData.get("couleur_principale") as string,
    police: formData.get("police") as string,
    metiers: METIERS.map((m) => m.id).filter((id) => formData.get(`metier_${id}`) === "on"),
  }

  const { error } = await supabase.from("orgs").update(data).eq("id", profile.org_id)
  if (error) throw new Error(error.message)
  redirect("/app/parametres/societe?ok=1")
}

import { SavedToast } from "./saved-toast"

export default async function SocietePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user!.id).maybeSingle()
  const { data: org } = await supabase.from("orgs").select("*").eq("id", profile!.org_id!).maybeSingle()
  const isOwner = profile?.role === "owner" || profile?.role === "admin_dep"
  const currentMetiers: string[] = org?.metiers ?? []

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-6">
      <Link href="/app/parametres" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
        <ArrowLeft className="h-3 w-3" /> Paramètres
      </Link>
      <SavedToast />
      <CardTitle>Société</CardTitle>
      <p className="text-sm text-muted -mt-3">
        Ces informations apparaissent sur vos devis et factures.
      </p>

      <form action={saveSociete}>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-electric" />
            <h3 className="font-display font-semibold">Identité de l&apos;entreprise</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="nom">Nom de l&apos;entreprise *</Label>
              <Input id="nom" name="nom" className="mt-2" defaultValue={org?.nom ?? ""} required />
            </div>
            <div>
              <Label htmlFor="forme_juridique">Forme juridique</Label>
              <Input id="forme_juridique" name="forme_juridique" className="mt-2" defaultValue={org?.forme_juridique ?? ""} placeholder="SARL, SAS, EI…" />
            </div>
            <div>
              <Label htmlFor="capital_social">Capital social</Label>
              <Input id="capital_social" name="capital_social" className="mt-2" defaultValue={org?.capital_social ?? ""} placeholder="10 000 €" />
            </div>
            <div>
              <Label htmlFor="siret">
                <FileText className="inline h-3 w-3 mr-1" />
                SIRET
              </Label>
              <Input id="siret" name="siret" className="mt-2 font-mono" defaultValue={org?.siret ?? ""} placeholder="123 456 789 00012" />
            </div>
            <div>
              <Label htmlFor="rcs">RCS</Label>
              <Input id="rcs" name="rcs" className="mt-2" defaultValue={org?.rcs ?? ""} placeholder="B 123 456 789" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="tva_intracommunautaire">TVA intracommunautaire</Label>
              <Input id="tva_intracommunautaire" name="tva_intracommunautaire" className="mt-2" defaultValue={org?.tva_intracommunautaire ?? ""} placeholder="FR12 345 678 789" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-4 w-4 text-electric" />
            <h3 className="font-display font-semibold">Métiers exercés</h3>
          </div>
          <p className="text-xs text-muted mb-4">Sélectionnez vos métiers pour recevoir des suggestions d&apos;articles adaptées.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {METIERS.map((m) => (
              <label key={m.id} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${currentMetiers.includes(m.id) ? "border-electric bg-electric/5" : "border-border hover:border-border-strong"}`}>
                <input type="checkbox" name={`metier_${m.id}`} defaultChecked={currentMetiers.includes(m.id)} className="accent-electric" />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-electric" />
            <h3 className="font-display font-semibold">Coordonnées</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" name="adresse" className="mt-2" defaultValue={org?.adresse ?? ""} placeholder="12 rue de la Gare" />
            </div>
            <div>
              <Label htmlFor="cp">Code postal</Label>
              <Input id="cp" name="cp" className="mt-2 font-mono" defaultValue={org?.cp ?? ""} placeholder="29200" />
            </div>
            <div>
              <Label htmlFor="ville">Ville</Label>
              <Input id="ville" name="ville" className="mt-2" defaultValue={org?.ville ?? ""} placeholder="Brest" />
            </div>
            <div>
              <Label htmlFor="pays">Pays</Label>
              <Input id="pays" name="pays" className="mt-2" defaultValue={org?.pays ?? ""} placeholder="France" />
            </div>
            <div>
              <Label htmlFor="tel">Téléphone</Label>
              <Input id="tel" name="tel" type="tel" className="mt-2" defaultValue={org?.tel ?? ""} placeholder="06 12 34 56 78" />
            </div>
            <div>
              <Label htmlFor="email">Email de contact</Label>
              <Input id="email" name="email" type="email" className="mt-2" defaultValue={org?.email ?? ""} placeholder="contact@entreprise.fr" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="h-4 w-4 text-electric" />
            <h3 className="font-display font-semibold">RIB — Relevé d&apos;Identité Bancaire</h3>
          </div>
          <p className="text-xs text-muted mb-4">Apparaît sur les factures pour le virement.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" name="iban" className="mt-2 font-mono text-sm" defaultValue={org?.iban ?? ""} placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" />
            </div>
            <div>
              <Label htmlFor="bic">BIC / SWIFT</Label>
              <Input id="bic" name="bic" className="mt-2 font-mono" defaultValue={org?.bic ?? ""} placeholder="CMCIFRPP" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-electric" />
            <h3 className="font-display font-semibold">Conditions de règlement</h3>
          </div>
          <p className="text-xs text-muted mb-4">Ces conditions apparaissent en bas de chaque devis.</p>
          <div>
            <Label htmlFor="conditions_reglement">Texte des conditions</Label>
            <textarea
              id="conditions_reglement"
              name="conditions_reglement"
              className="mt-2 flex min-h-[100px] w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-2 transition-colors focus-visible:border-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40"
              defaultValue={org?.conditions_reglement ?? ""}
              placeholder="Paiement à réception de facture..."
              rows={4}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-display font-semibold">🎨 Personnalisation du devis</h3>
          </div>
          <p className="text-xs text-muted mb-4">Couleur principale et police utilisées sur vos devis.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="couleur_principale">Couleur principale</Label>
              <div className="flex items-center gap-2 mt-2">
                <input id="couleur_principale" name="couleur_principale" type="color" defaultValue={org?.couleur_principale ?? "#1e40af"} className="h-10 w-10 rounded border border-border cursor-pointer" />
                <input name="couleur_principale" type="text" defaultValue={org?.couleur_principale ?? "#1e40af"} className="flex h-11 rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm text-foreground font-mono w-28" />
              </div>
            </div>
            <div>
              <Label htmlFor="police">Police d'écriture</Label>
              <select id="police" name="police" defaultValue={org?.police ?? "Inter"} className="mt-2 flex h-11 w-full rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm text-foreground">
                <option value="Inter">Inter (moderne)</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Geist">Geist</option>
                <option value="Merriweather">Merriweather (classique)</option>
                <option value="Courier Prime">Courier Prime (machine)</option>
              </select>
            </div>
          </div>
        </Card>

        {isOwner && (
          <div className="sticky bottom-4 z-30">
            <div className="glass border border-border rounded-[var(--radius-lg)] p-3 flex justify-end">
              <Button type="submit">
                <Save className="h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>
        )}
      </form>

      {!isOwner && (
        <p className="text-sm text-warning">Seul le propriétaire peut modifier ces informations.</p>
      )}
    </div>
  )
}
