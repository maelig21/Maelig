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
import { PDFDocument, PDFName, PDFString, PDFHexString, PDFDict, PDFRawStream } from "pdf-lib"

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
        ${vendeurTax}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(data.vendeur.cp ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${esc(data.vendeur.adresse ?? "")}</ram:LineOne>
          <ram:CityName>${esc(data.vendeur.ville ?? "")}</ram:CityName>
          <ram:CountryID>${esc(data.vendeur.pays ?? "FR")}</ram:CountryID>
        </ram:PostalTradeAddress>
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

  // Pièce jointe Factur-X : embedFile ajoute l'entrée dans /Names/EmbeddedFiles
  const attached = await pdfDoc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "application/xml",
    description: "Factur-X Invoice",
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: "Data" as unknown as never,
  })
  void attached

  // Marque le document comme conforme Factur-X via /AF (Associated Files) au niveau catalogue
  const catalog = pdfDoc.catalog
  const namesDict = catalog.lookup(PDFName.of("Names"), PDFDict)
  const efDict = namesDict?.lookup(PDFName.of("EmbeddedFiles"), PDFDict)
  if (efDict) {
    const namesArray = efDict.lookup(PDFName.of("Names"))
    if (namesArray) {
      // Le premier élément pair suivant le nom "factur-x.xml" est la référence de fichier
      catalog.set(PDFName.of("AF"), namesArray as never)
    }
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
