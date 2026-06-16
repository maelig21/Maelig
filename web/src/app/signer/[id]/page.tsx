import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { formatEUR, formatDateFR } from "@/lib/utils"
import { SignerClient } from "./client"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  // Accès public — on utilise le client admin pour lire le devis sans auth
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: devis } = await admin
    .from("devis")
    .select("*, clients(*), devis_items(*), orgs(nom, adresse, ville, cp, tel, email, logo_url, siret, couleur_principale, police, conditions_reglement)")
    .eq("id", id)
    .maybeSingle()

  if (!devis) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = devis.orgs as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = devis.clients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (devis.devis_items as any[]) ?? []

  const totalHT = items.reduce((s: number, it: any) => s + Number(it.quantite) * Number(it.prix_unitaire_ht), 0)
    + (devis.heures_main_oeuvre || 0) * (devis.taux_horaire || 0)
  const tva = totalHT * (devis.tva_taux || 20) / 100
  const totalTTC = totalHT + tva

  const dejaSigné = devis.statut === "signe_non_paye" || devis.statut === "facture_en_attente" || devis.statut === "facture_payee"

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header DEP */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">DEP</div>
          <div className="text-sm text-gray-500">Devis et gestion d&apos;entreprise</div>
        </div>

        {/* Devis document */}
        <div
          className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          style={{
            "--devis-color": org?.couleur_principale || "#1e40af",
            fontFamily: org?.police || "Inter",
          } as React.CSSProperties}
        >
          {/* Bande couleur en haut */}
          <div className="h-2" style={{ backgroundColor: org?.couleur_principale || "#1e40af" }} />

          <div className="p-6 sm:p-10 space-y-8">

            {/* Header */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                {org?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="Logo" className="h-8 object-contain mb-3" />
                ) : (
                  <div className="text-2xl font-bold text-gray-800 mb-3">{org?.nom || "Mon Entreprise"}</div>
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
                <div className="text-3xl font-bold text-gray-900">DEVIS</div>
                <div className="text-sm text-gray-500 mt-1">N° DEP-{id.slice(0, 8).toUpperCase()}</div>
                {devis.date_creation && (
                  <div className="text-sm text-gray-500">Date : {formatDateFR(devis.date_creation)}</div>
                )}
                {client && (
                  <div className="mt-4 text-sm text-gray-700">
                    <div className="font-semibold">{[client.prenom, client.nom].filter(Boolean).join(" ")}</div>
                    {client.email && <div>{client.email}</div>}
                    {client.tel && <div>{client.tel}</div>}
                    {client.adresse && <div>{client.adresse}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Objet */}
            {devis.objet && (
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
                  <th className="text-right py-2 text-gray-600 font-medium">PU HT</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">{it.designation || it.nom}</td>
                    <td className="py-2 text-right text-gray-700">{it.quantite}</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(it.prix_unitaire_ht)}</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(Number(it.quantite) * Number(it.prix_unitaire_ht))}</td>
                  </tr>
                ))}
                {devis.heures_main_oeuvre > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">Main d&apos;œuvre ({devis.heures_main_oeuvre}h × {formatEUR(devis.taux_horaire)}/h)</td>
                    <td className="py-2 text-right text-gray-700">1</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(devis.heures_main_oeuvre * devis.taux_horaire)}</td>
                    <td className="py-2 text-right text-gray-700">{formatEUR(devis.heures_main_oeuvre * devis.taux_horaire)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totaux */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total HT</span>
                  <span className="font-medium">{formatEUR(totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TVA ({devis.tva_taux || 20}%)</span>
                  <span className="font-medium">{formatEUR(tva)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-bold text-gray-900">Total TTC</span>
                  <span className="font-bold text-lg" style={{ color: org?.couleur_principale || "#1e40af" }}>{formatEUR(totalTTC)}</span>
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

        {/* Zone signature */}
        <SignerClient devisId={id} dejaSigné={dejaSigné} />

        <div className="text-center text-xs text-gray-400">
          Propulsé par <span className="font-semibold">DEP</span> · dep-pro.fr
        </div>
      </div>
    </div>
  )
}
