import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardTitle, Badge } from "@/components/ui/card"
import { formatEUR, formatDateFR } from "@/lib/utils"
import { FactureActions } from "./actions"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUT_META: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  en_attente: { label: "En attente", tone: "warning" },
  partielle: { label: "Partielle", tone: "warning" },
  payee: { label: "Payée", tone: "success" },
  abandonnee: { label: "Abandonnée", tone: "neutral" },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user!.id).maybeSingle()

  const [factureRes, orgRes] = await Promise.all([
    supabase
      .from("factures")
      .select("*, clients(*), devis(*, devis_items(*))")
      .eq("id", id)
      .eq("org_id", profile!.org_id!)
      .maybeSingle(),
    supabase
      .from("orgs")
      .select("nom, adresse, ville, cp, tel, email, logo_url, siret, conditions_reglement, couleur_principale, police")
      .eq("id", profile!.org_id!)
      .maybeSingle(),
  ])

  const facture = factureRes.data
  if (!facture) notFound()

  const org = orgRes.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = facture.clients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devis = facture.devis as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (devis?.devis_items as any[]) ?? []
  const meta = STATUT_META[facture.statut] ?? { label: facture.statut, tone: "neutral" as const }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/app/devis/factures-en-attente" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
          <ArrowLeft className="h-3 w-3" /> Factures en attente
        </Link>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {/* Document facture */}
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden print:shadow-none"
        style={{
          "--devis-color": org?.couleur_principale || "#1e40af",
          fontFamily: org?.police || "Inter",
        } as React.CSSProperties}
      >
        <div className="h-2" style={{ backgroundColor: org?.couleur_principale || "#1e40af" }} />
        <div className="p-6 sm:p-10 space-y-8">

          {/* Header */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              {org?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logo_url} alt="Logo" className="h-12 object-contain mb-3" />
              ) : (
                <div className="text-2xl font-bold text-gray-800 mb-3">{org?.nom}</div>
              )}
              <div className="text-sm text-gray-600 space-y-1">
                <div className="font-semibold text-gray-900">{org?.nom}</div>
                {org?.adresse && <div>{org.adresse}</div>}
                {(org?.cp || org?.ville) && <div>{org.cp} {org.ville}</div>}
                {org?.tel && <div>{org.tel}</div>}
                {org?.siret && <div>SIRET : {org.siret}</div>}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-3xl font-bold text-gray-900">FACTURE</div>
              {facture.numero && <div className="text-sm text-gray-500 mt-1">N° {facture.numero}</div>}
              {facture.date_emission && <div className="text-sm text-gray-500">Date : {formatDateFR(facture.date_emission)}</div>}
              {facture.date_echeance && <div className="text-sm text-gray-500">Échéance : {formatDateFR(facture.date_echeance)}</div>}
              {c && (
                <div className="mt-4 text-sm text-gray-700">
                  <div className="font-semibold">{c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" ")}</div>
                  {c.email && <div>{c.email}</div>}
                  {c.tel && <div>{c.tel}</div>}
                  {c.adresse && <div>{c.adresse}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Objet */}
          {devis?.objet && (
            <div className="border-l-4 pl-4" style={{ borderColor: org?.couleur_principale || "#1e40af" }}>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Objet</div>
              <div className="font-semibold text-gray-900">{devis.objet}</div>
            </div>
          )}

          {/* Lignes */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-600 font-medium">Désignation</th>
                <th className="text-right py-2 text-gray-600 font-medium">Qté</th>
                <th className="text-right py-2 text-gray-600 font-medium">Unité</th>
                <th className="text-right py-2 text-gray-600 font-medium">PU HT</th>
                <th className="text-right py-2 text-gray-600 font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => (
                it.is_section ? (
                  <tr key={i}>
                    <td colSpan={5} className="py-3 font-bold text-gray-900 border-b border-gray-100">{it.description}</td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">{it.description}</td>
                    <td className="py-2 text-right text-gray-700">{it.quantite}</td>
                    <td className="py-2 text-right text-gray-500">{it.unite}</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(it.prix_unitaire_ht)}</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(it.total_ht)}</td>
                  </tr>
                )
              ))}
              {devis?.heures_main_oeuvre > 0 && (
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <td className="py-2 text-gray-800">Main d&apos;œuvre ({devis.heures_main_oeuvre}h)</td>
                  <td className="py-2 text-right text-gray-700">1</td>
                  <td className="py-2 text-right text-gray-500">forfait</td>
                  <td className="py-2 text-right text-gray-700">{formatEUR(devis.cout_main_oeuvre_ht)}</td>
                  <td className="py-2 text-right text-gray-700">{formatEUR(devis.cout_main_oeuvre_ht)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total HT</span>
                <span className="font-medium">{formatEUR(facture.total_ht)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">TVA</span>
                <span className="font-medium">{formatEUR(facture.tva_montant)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-bold text-gray-900">Total TTC</span>
                <span className="font-bold text-lg" style={{ color: org?.couleur_principale || "#1e40af" }}>{formatEUR(facture.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {org?.conditions_reglement && (
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-4">
              {org.conditions_reglement}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6">
        <FactureActions factureId={id} statut={facture.statut} devisId={devis?.id} />
      </div>
    </div>
  )
}
