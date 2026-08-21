import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { formatEUR, formatDateFR } from "@/lib/utils"
import { CheckCircle, Landmark } from "lucide-react"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: facture } = await admin
    .from("factures")
    .select("*, clients(*), orgs(nom, adresse, ville, cp, siret, logo_url, couleur_principale, iban, bic), devis(objet, devis_items(*))")
    .eq("id", id)
    .maybeSingle()

  if (!facture) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = facture.clients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = facture.orgs as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devis = facture.devis as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (devis?.devis_items as any[]) ?? []
  const reste = Number(facture.total_ttc) - Number(facture.montant_paye ?? 0)
  const dejaPayee = facture.statut === "payee"

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">⚡ DEP</div>
          <div className="text-sm text-gray-500">Paiement de facture</div>
        </div>

        {/* Document facture */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="h-2" style={{ backgroundColor: org?.couleur_principale || "#1e40af" }} />
          <div className="p-6 sm:p-10 space-y-6">

            {/* En-tête */}
            <div className="flex items-start justify-between gap-4">
              <div>
                {org?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="Logo" className="h-12 object-contain mb-2" />
                ) : (
                  <div className="text-xl font-bold text-gray-900 mb-1">{org?.nom}</div>
                )}
                <div className="text-xs text-gray-500 space-y-0.5">
                  {org?.adresse && <div>{org.adresse}</div>}
                  {(org?.cp || org?.ville) && <div>{org.cp} {org.ville}</div>}
                  {org?.siret && <div>SIRET : {org.siret}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">FACTURE</div>
                <div className="text-xs text-gray-500 mt-1">N° {facture.numero}</div>
                {facture.date_emission && <div className="text-xs text-gray-500">Le {formatDateFR(facture.date_emission)}</div>}
              </div>
            </div>

            {c && (
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-1">Facturé à</div>
                <div className="font-medium">{c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" ")}</div>
                {c.adresse && <div className="text-xs text-gray-500">{c.adresse}</div>}
              </div>
            )}

            {devis?.objet && (
              <div className="border-l-4 pl-3" style={{ borderColor: org?.couleur_principale || "#1e40af" }}>
                <div className="text-xs text-gray-400 uppercase">Objet</div>
                <div className="font-semibold text-gray-800">{devis.objet}</div>
              </div>
            )}

            {/* Détail des lignes */}
            {items.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="text-left py-2">Désignation</th>
                    <th className="text-right py-2">Qté</th>
                    <th className="text-right py-2">PU HT</th>
                    <th className="text-right py-2">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    it.is_section ? (
                      <tr key={i} className="bg-gray-100">
                        <td colSpan={4} className="py-2 px-2 font-bold text-xs uppercase text-gray-600">{it.description}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 text-gray-700">{it.description}</td>
                        <td className="py-2 text-right text-gray-600">{it.quantite}</td>
                        <td className="py-2 text-right text-gray-600">{formatEUR(it.prix_unitaire_ht)}</td>
                        <td className="py-2 text-right font-medium text-gray-800">{formatEUR(it.total_ht)}</td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            )}

            {/* Totaux */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Total HT</span>
                  <span>{formatEUR(facture.total_ht)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>TVA</span>
                  <span>{formatEUR(facture.tva_montant)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5" style={{ color: org?.couleur_principale || "#1e40af" }}>
                  <span>Total TTC</span>
                  <span>{formatEUR(facture.total_ttc)}</span>
                </div>
                {Number(facture.montant_paye ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600 text-xs">
                    <span>Déjà réglé</span>
                    <span>-{formatEUR(facture.montant_paye)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1.5" style={{ color: org?.couleur_principale || "#1e40af" }}>
                  <span>Reste à payer</span>
                  <span>{formatEUR(reste)}</span>
                </div>
              </div>
            </div>

            {/* Paiement */}
            {dejaPayee ? (
              <div className="text-center space-y-3 py-4 border-t border-gray-100">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-lg font-bold text-gray-900">Facture réglée ✓</div>
              </div>
            ) : org?.iban ? (
              <div className="bg-gray-50 rounded-xl p-5 space-y-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Landmark className="h-4 w-4" /> Règlement par virement bancaire
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-500 text-xs">Bénéficiaire</div>
                    <div className="font-medium text-gray-900">{org.nom}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-500 text-xs">IBAN</div>
                    <div className="font-mono font-medium text-gray-900 select-all text-xs">{org.iban}</div>
                  </div>
                  {org.bic && (
                    <div className="space-y-1 text-sm">
                      <div className="text-gray-500 text-xs">BIC</div>
                      <div className="font-mono font-medium text-gray-900 select-all text-xs">{org.bic}</div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                  Merci d&apos;indiquer la référence <span className="font-mono">{facture.numero}</span> lors du virement.
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4 border-t border-gray-100">
                Contactez {org?.nom} pour connaître les modalités de règlement.
              </div>
            )}

          </div>
        </div>

        <div className="text-center text-xs text-gray-400">
          Propulsé par <span className="font-semibold">DEP</span> · dep-pro.fr
        </div>
      </div>
    </div>
  )
}
