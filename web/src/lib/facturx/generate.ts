/**
 * Génération de factures conformes Factur-X (EN 16931).
 * Prépare DEP pour la réforme de facturation électronique française
 * (obligation d'émission pour TPE/PME au 1er septembre 2027).
 */
import { embedFacturX, DocumentTypeCode, Profile } from "@stackforge-eu/factur-x"

export type FacturXInvoiceData = {
  numero: string
  dateEmission: string // YYYY-MM-DD
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

/**
 * Génère le PDF Factur-X complet (XML CII embarqué + métadonnées PDF/A-3)
 * à partir d'un PDF classique déjà rendu et des données de facture.
 */
export async function generateFacturXPdf(pdfBuffer: Buffer, data: FacturXInvoiceData): Promise<Buffer> {
  const taxReg = data.vendeur.tvaIntracom
    ? [{ id: data.vendeur.tvaIntracom, schemeId: "VA" as const }]
    : data.vendeur.siret
    ? [{ id: data.vendeur.siret, schemeId: "SIRET" as const }]
    : []

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
        vatCategory: { percent: l.tvaTaux },
      })),
      totals: {
        currency: data.devise ?? "EUR",
        taxBasisTotal: data.totalHT,
        taxTotal: data.totalTVA,
        grandTotal: data.totalTTC,
      },
    },
    profile: Profile.BASIC_WL,
  })

  return Buffer.from(result)
}
