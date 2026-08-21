import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { formatEUR } from "@/lib/utils"
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
    .select("*, clients(*), orgs(nom, logo_url, couleur_principale, iban, bic)")
    .eq("id", id)
    .maybeSingle()

  if (!facture) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = facture.clients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = facture.orgs as any
  const reste = Number(facture.total_ttc) - Number(facture.montant_paye ?? 0)
  const dejaPayee = facture.statut === "payee"

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">⚡ DEP</div>
          <div className="text-sm text-gray-500">Paiement de facture</div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="h-2" style={{ backgroundColor: org?.couleur_principale || "#1e40af" }} />
          <div className="p-6 sm:p-10 space-y-6">

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Facture N° {facture.numero}</div>
                <div className="text-xl font-bold text-gray-900">{org?.nom}</div>
              </div>
              {org?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logo_url} alt="Logo" className="h-10 object-contain" />
              )}
            </div>

            {c && (
              <div className="text-sm text-gray-600">
                Facturé à : <span className="font-medium">{c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" ")}</span>
              </div>
            )}

            <div className="border-t border-b border-gray-100 py-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total facture</span>
                <span>{formatEUR(facture.total_ttc)}</span>
              </div>
              {Number(facture.montant_paye ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Déjà réglé</span>
                  <span>-{formatEUR(facture.montant_paye)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold" style={{ color: org?.couleur_principale || "#1e40af" }}>
                <span>Reste à payer</span>
                <span>{formatEUR(reste)}</span>
              </div>
            </div>

            {dejaPayee ? (
              <div className="text-center space-y-3 py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-lg font-bold text-gray-900">Facture réglée ✓</div>
              </div>
            ) : org?.iban ? (
              <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Landmark className="h-4 w-4" /> Règlement par virement bancaire
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-500">Bénéficiaire</div>
                  <div className="font-mono font-medium text-gray-900">{org.nom}</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-500">IBAN</div>
                  <div className="font-mono font-medium text-gray-900 select-all">{org.iban}</div>
                </div>
                {org.bic && (
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-500">BIC</div>
                    <div className="font-mono font-medium text-gray-900 select-all">{org.bic}</div>
                  </div>
                )}
                <div className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                  Merci d&apos;indiquer la référence <span className="font-mono">{facture.numero}</span> lors du virement.
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
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
