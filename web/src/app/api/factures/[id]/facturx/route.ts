/**
 * Génère la facture Factur-X : PDF (pdf-lib, même bibliothèque que celle
 * utilisée en interne par @stackforge-eu/factur-x pour l'embarquement —
 * élimine tout risque d'incompatibilité de format entre deux libs PDF
 * différentes) + embarquement XML CII conforme EN16931/BASIC_WL.
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDateFR } from "@/lib/utils"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "@/lib/facturx/embedded-fonts"
import { generateFacturXPdf } from "@/lib/facturx/generate"

export const runtime = "nodejs"
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildBasePdf(facture: any, org: any, client: any, items: any[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const regularBytes = Buffer.from(LIBERATION_SANS_REGULAR, "base64")
  const boldBytes = Buffer.from(LIBERATION_SANS_BOLD, "base64")
  const fontRegular = await pdfDoc.embedFont(regularBytes, { subset: true })
  const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true })

  let page = pdfDoc.addPage([595.28, 841.89]) // A4 en points
  const { width, height } = page.getSize()
  const marginX = 50
  let y = height - 50
  const black = rgb(0.1, 0.1, 0.1)

  const draw = (text: string, x: number, yy: number, opts: { font?: typeof fontRegular; size?: number; align?: "left" | "right" } = {}) => {
    const font = opts.font ?? fontRegular
    const size = opts.size ?? 9
    const w = font.widthOfTextAtSize(text, size)
    const xx = opts.align === "right" ? x - w : x
    page.drawText(text, { x: xx, y: yy, size, font, color: black })
  }

  // En-tête entreprise (gauche)
  draw(String(org.nom ?? ""), marginX, y, { font: fontBold, size: 14 })
  y -= 16
  if (org.adresse) { draw(String(org.adresse), marginX, y); y -= 12 }
  if (org.cp || org.ville) { draw(`${org.cp ?? ""} ${org.ville ?? ""}`, marginX, y); y -= 12 }
  if (org.siret) { draw(`SIRET : ${org.siret}`, marginX, y); y -= 12 }

  // Titre + numéro (droite)
  draw("FACTURE", width - marginX, height - 50, { font: fontBold, size: 22, align: "right" })
  draw(`N° ${facture.numero ?? ""}`, width - marginX, height - 72, { align: "right" })
  draw(formatDateFR(String(facture.date_emission ?? "")), width - marginX, height - 84, { align: "right" })

  y -= 20
  // Client
  draw("Facturé à :", marginX, y, { font: fontBold, size: 10 })
  y -= 14
  draw(String(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || ""), marginX, y)
  y -= 12
  if (client.adresse) { draw(String(client.adresse), marginX, y); y -= 12 }

  y -= 20
  const colDesc = marginX
  const colQty = width - marginX - 170
  const colPu = width - marginX - 110
  const colTotal = width - marginX

  draw("Désignation", colDesc, y, { font: fontBold })
  draw("Qté", colQty + 30, y, { font: fontBold, align: "right" })
  draw("PU HT", colPu + 50, y, { font: fontBold, align: "right" })
  draw("Total HT", colTotal, y, { font: fontBold, align: "right" })
  y -= 6
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: black })
  y -= 14

  for (const it of items) {
    if (y < 100) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50 }
    draw(String(it.description ?? "").slice(0, 60), colDesc, y)
    draw(String(it.quantite ?? ""), colQty + 30, y, { align: "right" })
    draw(`${Number(it.prix_unitaire_ht).toFixed(2)} \u20ac`, colPu + 50, y, { align: "right" })
    draw(`${Number(it.total_ht).toFixed(2)} \u20ac`, colTotal, y, { align: "right" })
    y -= 16
  }

  y -= 6
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: black })
  y -= 20

  const totalsLabelX = width - marginX - 150
  draw("Total HT", totalsLabelX, y)
  draw(`${Number(facture.total_ht).toFixed(2)} \u20ac`, width - marginX, y, { align: "right" })
  y -= 14
  draw("TVA", totalsLabelX, y)
  draw(`${Number(facture.tva_montant).toFixed(2)} \u20ac`, width - marginX, y, { align: "right" })
  y -= 16
  draw("Total TTC", totalsLabelX, y, { font: fontBold, size: 11 })
  draw(`${Number(facture.total_ttc).toFixed(2)} \u20ac`, width - marginX, y, { font: fontBold, size: 11, align: "right" })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()
  if (!profile?.org_id) return NextResponse.json({ error: "no_org" }, { status: 403 })

  const { data: facture } = await supabase
    .from("factures")
    .select("*, clients(*), orgs(nom, siret, tva_intracommunautaire, adresse, ville, cp, pays), devis(devis_items(*))")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .maybeSingle()

  if (!facture) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = facture.clients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = facture.orgs as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devis = facture.devis as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((devis?.devis_items as any[]) ?? []).filter((it) => !it.is_section)

  if (!c) return NextResponse.json({ error: "no_client" }, { status: 400 })
  if (items.length === 0) return NextResponse.json({ error: "no_items" }, { status: 400 })

  try {
    const basePdf = await buildBasePdf(facture, org, c, items)

    const facturXPdf = await generateFacturXPdf(basePdf, {
      numero: facture.numero ?? id.slice(0, 8),
      dateEmission: facture.date_emission ?? new Date().toISOString().slice(0, 10),
      vendeur: {
        nom: org?.nom ?? "",
        siret: org?.siret,
        tvaIntracom: org?.tva_intracommunautaire,
        adresse: org?.adresse,
        ville: org?.ville,
        cp: org?.cp,
        pays: org?.pays || "FR",
      },
      acheteur: {
        nom: c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" "),
        siret: c.siret,
        adresse: c.adresse,
        ville: c.ville,
        cp: c.cp,
        pays: "FR",
      },
      lignes: items.map((it) => ({
        description: it.description,
        quantite: Number(it.quantite),
        prixUnitaireHT: Number(it.prix_unitaire_ht),
        tvaTaux: Number(facture.tva_taux ?? 20),
      })),
      totalHT: Number(facture.total_ht),
      totalTVA: Number(facture.tva_montant),
      totalTTC: Number(facture.total_ttc),
    })

    return new NextResponse(new Uint8Array(facturXPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="facture-${facture.numero ?? id.slice(0, 8)}-facturx.pdf"`,
      },
    })
  } catch (e) {
    console.error("[facturx] generation failed:", e)
    return NextResponse.json({ error: "facturx_generation_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
