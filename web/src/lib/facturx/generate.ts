/**
 * Génération de factures conformes Factur-X (EN 16931).
 * Prépare DEP pour la réforme de facturation électronique française
 * (obligation d'émission pour TPE/PME au 1er septembre 2027).
 *
 * Un fichier Factur-X = un PDF classique (lisible normalement) qui contient
 * en plus des données XML structurées cachées à l'intérieur, conformes à la
 * norme européenne EN 16931. C'est ce que les plateformes agréées (PA) et
 * les logiciels comptables attendent.
 */
import { buildXml, Profile, Flavor } from "@stackforge-eu/factur-x"

export type FacturXInvoiceData = {
  numero: string
  dateEmission: string // YYYY-MM-DD
  dateEcheance?: string
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
 * Construit le XML Factur-X (CII, profil EN16931) à partir des données de facture.
 * Ce XML est ensuite destiné à être embarqué dans le PDF de la facture.
 */
export function buildFacturXXml(data: FacturXInvoiceData): string {
  const invoiceData = {
    number: data.numero,
    issueDate: data.dateEmission,
    dueDate: data.dateEcheance,
    currency: data.devise ?? "EUR",
    seller: {
      name: data.vendeur.nom,
      vatId: data.vendeur.tvaIntracom ?? undefined,
      tradeRegisterId: data.vendeur.siret ?? undefined,
      address: {
        line1: data.vendeur.adresse ?? "",
        city: data.vendeur.ville ?? "",
        postCode: data.vendeur.cp ?? "",
        country: data.vendeur.pays ?? "FR",
      },
    },
    buyer: {
      name: data.acheteur.nom,
      tradeRegisterId: data.acheteur.siret ?? undefined,
      address: {
        line1: data.acheteur.adresse ?? "",
        city: data.acheteur.ville ?? "",
        postCode: data.acheteur.cp ?? "",
        country: data.acheteur.pays ?? "FR",
      },
    },
    lines: data.lignes.map((l, i) => ({
      id: String(i + 1),
      name: l.description,
      quantity: l.quantite,
      unitPrice: l.prixUnitaireHT,
      vatRate: l.tvaTaux,
    })),
    totals: {
      taxBasisTotal: data.totalHT,
      taxTotal: data.totalTVA,
      grandTotal: data.totalTTC,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildXml(invoiceData as any, Profile.EN16931)
}

/**
 * Embarque le XML Factur-X dans un PDF existant pour produire un PDF/A-3
 * conforme, lisible normalement mais contenant les données structurées.
 */
export async function embedFacturXInPdf(pdfBuffer: Buffer, xml: string, meta: { author: string; title: string }): Promise<Buffer> {
  const { generate } = await import("@stafyniaksacha/facturx")
  const result = await generate({
    pdf: pdfBuffer,
    xml,
    flavor: "facturx",
    level: "en16931",
    language: "fr-FR",
    meta: {
      author: meta.author,
      title: meta.title,
      subject: meta.title,
      keywords: ["facture", "factur-x"],
      date: new Date(),
    },
  })
  return Buffer.from(result)
}
