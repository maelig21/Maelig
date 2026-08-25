/**
 * Génération de factures conformes Factur-X (EN 16931).
 * Prépare DEP pour la réforme de facturation électronique française
 * (obligation d'émission pour TPE/PME au 1er septembre 2027).
 */
import { embedFacturX, DocumentTypeCode, Profile } from "@stackforge-eu/factur-x"

export type FacturXInvoiceData = {
  numero: string
  dateEmission: string
  vendeur: {
    nom: string
    siret?: string | null
    tvaIntracom?: string | null
    adresse?: string | null
    ville?: string | null
    cp?: string | null
    pays?: string
  }
  acheteur: {
    nom: string
    siret?: string | null
    adresse?: string | null
    ville?: string | null
    cp?: string | null
    pays?: string
  }
  lignes: Array<{
    description: string
    quantite: number
    prixUnitaireHT: number
    tvaTaux: number
  }>
  totalHT: number
  totalTVA: number
  totalTTC: number
  devise?: string
}

export async function generateFacturXPdf(pdfBuffer: Buffer, data: FacturXInvoiceData): Promise<Buffer> {
  const taxReg = data.vendeur.tvaIntracom
    ? [{ id: data.vendeur.tvaIntracom, schemeId: "VA" as const }]
    : data.vendeur.siret
    ? [{ id: data.vendeur.siret, schemeId: "SIRET" as const }]
    : []

  // Regrouper les lignes par taux de TVA pour le vatBreakdown
  const parTaux = new Map<number, { base: number; tva: number }>()
  for (const l of data.lignes) {
    const lineTotal = l.quantite * l.prixUnitaireHT
    const existing = parTaux.get(l.tvaTaux) ?? { base: 0, tva: 0 }
    existing.base += lineTotal
    existing.tva += lineTotal * (l.tvaTaux / 100)
    parTaux.set(l.tvaTaux, existing)
  }
  const vatBreakdown = Array.from(parTaux.entries()).map(([percent, { base, tva }]) => ({
    taxAmount: Number(tva.toFixed(2)),
    taxableAmount: Number(base.toFixed(2)),
    categoryCode: "S" as const,
    ratePercent: percent,
  }))

  const result = await embedFacturX({
    pdf: pdfBuffer,
    input: {
      document: {
        id: data.numero,
        issueDate: data.dateEmission,
        typeCode: DocumentTypeCode.COMMERCIAL_INVOICE,
      },
      seller: {
        name: data.vendeur.nom,
        address: {
          line1: data.vendeur.adresse ?? "",
          city: data.vendeur.ville ?? "",
          postalCode: data.vendeur.cp ?? "",
          country: data.vendeur.pays ?? "FR",
        },
        taxRegistrations: taxReg,
      },
      buyer: {
        name: data.acheteur.nom,
        address: {
          line1: data.acheteur.adresse ?? "",
          city: data.acheteur.ville ?? "",
          postalCode: data.acheteur.cp ?? "",
          country: data.acheteur.pays ?? "FR",
        },
      },
      lines: data.lignes.map((l, i) => ({
        id: String(i + 1),
        name: l.description,
        quantity: l.quantite,
        unitPrice: l.prixUnitaireHT,
        lineTotal: Number((l.quantite * l.prixUnitaireHT).toFixed(2)),
        vatCategory: { percent: l.tvaTaux, categoryCode: "S" as const },
      })),
      totals: {
        currency: data.devise ?? "EUR",
        lineTotal: Number(data.totalHT.toFixed(2)),
        taxBasisTotal: Number(data.totalHT.toFixed(2)),
        taxTotal: Number(data.totalTVA.toFixed(2)),
        grandTotal: Number(data.totalTTC.toFixed(2)),
        duePayableAmount: Number(data.totalTTC.toFixed(2)),
      },
      vatBreakdown,
    },
    profile: Profile.BASIC_WL,
  })

  return Buffer.from(result)
}
