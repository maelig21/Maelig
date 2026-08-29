/**
 * Génère la facture Factur-X en une seule passe : PDF (PDFKit, polices
 * embarquées) + embarquement XML CII conforme EN16931/BASIC_WL.
 * Fusionné en une route (pas de fetch interne inter-routes, plus fiable
 * en environnement serverless).
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDateFR } from "@/lib/utils"
import PDFDocument from "pdfkit"
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "@/lib/facturx/embedded-fonts"
import { generateFacturXPdf } from "@/lib/facturx/generate"

export const runtime = "nodejs"
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function buildBasePdf(facture: Record<string, unknown>, org: Record<string, unknown>, client: Record<string, unknown>, items: Record<string, unknown>[]): Promise<Buffer> {
  const regularBuf = Buffer.from(LIBERATION_SANS_REGULAR, "base64")
  const boldBuf = Buffer.from(LIBERATION_SANS_BOLD, "base64")

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, pdfVersion: "1.7" })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))))
    doc.on("error", reject)

    doc.registerFont("LibSans", regularBuf)
    doc.registerFont("LibSans-Bold", boldBuf)
    doc.font("LibSans")

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const startX = doc.page.margins.left

    doc.font("LibSans-Bold").fontSize(14).text(String(org.nom ?? ""), startX, 50)
    doc.font("LibSans").fontSize(9)
    if (org.adresse) doc.text(String(org.adresse))
    if (org.cp || org.ville) doc.text(`${org.cp ?? ""} ${org.ville ?? ""}`)
    if (org.siret) doc.text(`SIRET : ${org.siret}`)

    doc.font("LibSans-Bold").fontSize(22).text("FACTURE", startX, 50, { width: pageWidth, align: "right" })
    doc.font("LibSans").fontSize(9)
    doc.text(`N° ${facture.numero ?? ""}`, { width: pageWidth, align: "right" })
    doc.text(formatDateFR(String(facture.date_emission ?? "")), { width: pageWidth, align: "right" })

    doc.moveDown(2)
    doc.font("LibSans-Bold").fontSize(10).text("Facturé à :")
    doc.font("LibSans").fontSize(9)
    doc.text(String(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || ""))
    if (client.adresse) doc.text(String(client.adresse))

    doc.moveDown(1.5)
    const colDesc = startX
    const colQty = startX + pageWidth - 170
    const colPu = startX + pageWidth - 110
    const colTotal = startX + pageWidth - 50
    let y = doc.y

    doc.font("LibSans-Bold").fontSize(9)
    doc.text("Désignation", colDesc, y)
    doc.text("Qté", colQty, y, { width: 40, align: "right" })
    doc.text("PU HT", colPu, y, { width: 60, align: "right" })
    doc.text("Total HT", colTotal, y, { width: 60, align: "right" })
    y += 14
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(0.5).stroke()
    y += 8

    doc.font("LibSans").fontSize(9)
    for (const it of items) {
      if (y > 720) { doc.addPage(); y = 50 }
      const desc = String(it.description ?? "")
      const descHeight = doc.heightOfString(desc, { width: colQty - colDesc - 10 })
      doc.text(desc, colDesc, y, { width: colQty - colDesc - 10 })
      doc.text(String(it.quantite ?? ""), colQty, y, { width: 40, align: "right" })
      doc.text(`${Number(it.prix_unitaire_ht).toFixed(2)} €`, colPu, y, { width: 60, align: "right" })
      doc.text(`${Number(it.total_ht).toFixed(2)} €`, colTotal, y, { width: 60, align: "right" })
      y += Math.max(descHeight, 12) + 4
    }

    y += 4
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(0.5).stroke()
    y += 12

    const totalsX = startX + pageWidth - 150
    doc.font("LibSans").fontSize(9)
    doc.text("Total HT", totalsX, y, { width: 90 })
    doc.text(`${Number(facture.total_ht).toFixed(2)} €`, totalsX + 90, y, { width: 60, align: "right" })
    y += 14
    doc.text("TVA", totalsX, y, { width: 90 })
    doc.text(`${Number(facture.tva_montant).toFixed(2)} €`, totalsX + 90, y, { width: 60, align: "right" })
    y += 16
    doc.font("LibSans-Bold").fontSize(11)
    doc.text("Total TTC", totalsX, y, { width: 90 })
    doc.text(`${Number(facture.total_ttc).toFixed(2)} €`, totalsX + 90, y, { width: 60, align: "right" })

    doc.end()
  })
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePdf = await buildBasePdf(facture as any, org, c, items)

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
