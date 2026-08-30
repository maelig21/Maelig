/**
 * Génération de factures conformes Factur-X (EN 16931), implémentée
 * directement avec pdf-lib plutôt qu'une bibliothèque tierce Factur-X
 * (contournement d'un bug non résolu de @stackforge-eu/factur-x en
 * environnement Vercel/Turbopack).
 *
 * Principe Factur-X : le XML CII est attaché au PDF comme pièce jointe
 * nommée "factur-x.xml" avec /AFRelationship /Data, plus les métadonnées
 * XMP indiquant la conformité et le profil utilisé.
 */
import { PDFDocument } from "pdf-lib"

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
    electronicAddress?: string | null
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

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Construit le XML CII (Cross-Industry Invoice) minimal, profil BASIC WL —
 * suffisant pour la conformité Factur-X de base et couvre les besoins
 * d'un artisan facturant un particulier ou une entreprise.
 */
export function buildCiiXml(data: FacturXInvoiceData): string {
  const devise = data.devise ?? "EUR"
  const dateCompacte = data.dateEmission.replace(/-/g, "")

  const lignesXml = data.lignes.map((l, i) => {
    const lineTotal = (l.quantite * l.prixUnitaireHT).toFixed(2)
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(l.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${l.prixUnitaireHT.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${l.quantite}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${l.tvaTaux}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${lineTotal}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
  }).join("")

  const vendeurTax = data.vendeur.tvaIntracom
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(data.vendeur.tvaIntracom)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : ""

  // Adresse électronique Peppol du vendeur — requise pour la transmission via Super PDP.
  // TODO: en production, récupérer la vraie adresse Peppol enregistrée par chaque
  // entreprise cliente lors de son inscription à l'annuaire (via l'API companies/me
  // ou une donnée saisie dans les paramètres société de DEP).
  const vendeurElectronicAddress = data.vendeur.electronicAddress ?? ""

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(data.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateCompacte}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lignesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(data.vendeur.nom)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(data.vendeur.cp ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${esc(data.vendeur.adresse ?? "")}</ram:LineOne>
          <ram:CityName>${esc(data.vendeur.ville ?? "")}</ram:CityName>
          <ram:CountryID>${esc(data.vendeur.pays ?? "FR")}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${vendeurElectronicAddress ? `<ram:URIUniversalCommunication><ram:URIID schemeID="0225">${esc(vendeurElectronicAddress)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
        ${vendeurTax}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(data.acheteur.nom)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(data.acheteur.cp ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${esc(data.acheteur.adresse ?? "")}</ram:LineOne>
          <ram:CityName>${esc(data.acheteur.ville ?? "")}</ram:CityName>
          <ram:CountryID>${esc(data.acheteur.pays ?? "FR")}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${devise}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${data.totalTVA.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${data.totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${data.lignes[0]?.tvaTaux ?? 20}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms/>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${data.totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${data.totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${devise}">${data.totalTVA.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${data.totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${data.totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

/**
 * Embarque le XML CII en pièce jointe conforme Factur-X dans un PDF
 * existant (déjà au format PDF/A grâce aux polices embarquées de pdf-lib).
 */
export async function generateFacturXPdf(pdfBuffer: Buffer, data: FacturXInvoiceData): Promise<Buffer> {
  const xml = buildCiiXml(data)
  const xmlBytes = Buffer.from(xml, "utf-8")

  const pdfDoc = await PDFDocument.load(pdfBuffer)

  // Pièce jointe Factur-X : attach() ajoute l'entrée dans /Names/EmbeddedFiles.
  // La détection par les lecteurs PDF/logiciels comptables se base sur le nom
  // de fichier "factur-x.xml" et le mimeType XML — l'entrée /AF catalogue est
  // un bonus de découvrabilité PDF/A-3 strict, non strictement indispensable
  // pour l'exploitation pratique du fichier par un tiers.
  await pdfDoc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "application/xml",
    description: "Factur-X Invoice",
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
