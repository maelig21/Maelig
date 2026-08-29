/**
 * Génère la facture Factur-X : PDF (pdf-lib) avec mise en page complète
 * (logo, coordonnées entreprise/client, sections) + embarquement XML CII
 * conforme EN16931/BASIC_WL en pièce jointe.
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDateFR } from "@/lib/utils"
import { PDFDocument, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "@/lib/facturx/embedded-fonts"
import { generateFacturXPdf } from "@/lib/facturx/generate"

export const runtime = "nodejs"
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE_SIZE: [number, number] = [595.28, 841.89] // A4 en points

function hexToRgb(hex?: string | null): { r: number; g: number; b: number } {
  const fallback = { r: 0.12, g: 0.25, b: 0.68 } // bleu par défaut
  if (!hex) return fallback
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return fallback
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildBasePdf(facture: any, org: any, client: any, items: any[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const regularBytes = Buffer.from(LIBERATION_SANS_REGULAR, "base64")
  const boldBytes = Buffer.from(LIBERATION_SANS_BOLD, "base64")
  const fontRegular = await pdfDoc.embedFont(regularBytes, { subset: true })
  const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true })

  const accent = hexToRgb(org.couleur_principale)
  const accentColor = rgb(accent.r, accent.g, accent.b)
  const black = rgb(0.12, 0.12, 0.14)
  const gray = rgb(0.45, 0.45, 0.48)
  const lightGray = rgb(0.92, 0.92, 0.93)

  let page = pdfDoc.addPage(PAGE_SIZE)
  const { width, height } = page.getSize()
  const marginX = 50

  // Taille du logo selon le réglage de l'éditeur d'apparence (petit/moyen/grand)
  // — mêmes proportions que LOGO_TAILLES côté web (h-8/h-14/h-20 en px CSS,
  // converties en points PDF ~0.75x pour un rendu visuellement équivalent)
  const logoTailleReglage = (org.devis_settings as { logo_taille?: string } | null)?.logo_taille ?? "moyen"
  const LOGO_HEIGHTS: Record<string, number> = { petit: 24, moyen: 42, grand: 60 }
  const logoTargetHeight = LOGO_HEIGHTS[logoTailleReglage] ?? LOGO_HEIGHTS.moyen

  // Tente de récupérer et embarquer le logo si disponible
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | Awaited<ReturnType<typeof pdfDoc.embedJpg>> | null = null
  if (org.logo_url) {
    try {
      const res = await fetch(org.logo_url)
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get("content-type") ?? ""
        logoImage = contentType.includes("png") || org.logo_url.toLowerCase().endsWith(".png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes)
      }
    } catch {
      // Logo indisponible : on continue sans, non bloquant
    }
  }

  const draw = (
    text: string,
    x: number,
    yy: number,
    opts: { font?: typeof fontRegular; size?: number; align?: "left" | "right"; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const font = opts.font ?? fontRegular
    const size = opts.size ?? 9
    const color = opts.color ?? black
    const w = font.widthOfTextAtSize(text, size)
    const xx = opts.align === "right" ? x - w : x
    page.drawText(text, { x: xx, y: yy, size, font, color })
  }

  // Bande de couleur en haut de page
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: accentColor })

  let y = height - 50

  // Logo ou nom (gauche)
  if (logoImage) {
    const scale = logoTargetHeight / logoImage.height
    page.drawImage(logoImage, { x: marginX, y: y - logoTargetHeight + 10, width: logoImage.width * scale, height: logoTargetHeight })
    y -= logoTargetHeight + 4
  } else {
    draw(String(org.nom ?? ""), marginX, y, { font: fontBold, size: 15 })
    y -= 18
  }

  draw(String(org.nom ?? ""), marginX, y, { font: fontBold, size: 10 })
  y -= 12
  if (org.adresse) { draw(String(org.adresse), marginX, y, { size: 8, color: gray }); y -= 10 }
  if (org.cp || org.ville) { draw(`${org.cp ?? ""} ${org.ville ?? ""}`, marginX, y, { size: 8, color: gray }); y -= 10 }
  if (org.siret) { draw(`SIRET : ${org.siret}`, marginX, y, { size: 8, color: gray }); y -= 10 }
  if (org.tel) { draw(`Tél : ${org.tel}`, marginX, y, { size: 8, color: gray }); y -= 10 }
  if (org.email) { draw(`Email : ${org.email}`, marginX, y, { size: 8, color: gray }); y -= 10 }

  const leftBottomY = y

  // Titre + numéro (droite)
  draw("FACTURE", width - marginX, height - 50, { font: fontBold, size: 22, align: "right", color: accentColor })
  draw(`N° ${facture.numero ?? ""}`, width - marginX, height - 72, { align: "right", size: 8, color: gray })
  draw(formatDateFR(String(facture.date_emission ?? "")), width - marginX, height - 84, { align: "right", size: 8, color: gray })

  // Bloc client (droite, sous le numéro)
  let cy = height - 105
  draw("FACTURÉ À", width - marginX, cy, { align: "right", size: 7, color: gray, font: fontBold })
  cy -= 12
  draw(String(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || ""), width - marginX, cy, { align: "right", font: fontBold, size: 9 })
  cy -= 11
  if (client.adresse) { draw(String(client.adresse), width - marginX, cy, { align: "right", size: 8, color: gray }); cy -= 10 }
  if (client.cp || client.ville) { draw(`${client.cp ?? ""} ${client.ville ?? ""}`, width - marginX, cy, { align: "right", size: 8, color: gray }); cy -= 10 }
  if (client.email) { draw(String(client.email), width - marginX, cy, { align: "right", size: 8, color: gray }); cy -= 10 }
  if (client.telephone) { draw(String(client.telephone), width - marginX, cy, { align: "right", size: 8, color: gray }); cy -= 10 }

  y = Math.min(leftBottomY, cy) - 25

  const colDesc = marginX
  const colQty = width - marginX - 170
  const colPu = width - marginX - 110
  const colTotal = width - marginX

  // En-tête tableau (fond léger)
  page.drawRectangle({ x: marginX - 6, y: y - 4, width: width - 2 * marginX + 12, height: 18, color: lightGray })
  draw("DÉSIGNATION", colDesc, y, { font: fontBold, size: 8, color: gray })
  draw("QTÉ", colQty + 30, y, { font: fontBold, size: 8, color: gray, align: "right" })
  draw("PU HT", colPu + 50, y, { font: fontBold, size: 8, color: gray, align: "right" })
  draw("TOTAL HT", colTotal, y, { font: fontBold, size: 8, color: gray, align: "right" })
  y -= 22

  const ensureSpace = (needed: number) => {
    if (y - needed < 100) {
      page = pdfDoc.addPage(PAGE_SIZE)
      page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: accentColor })
      y = height - 60
    }
  }

  for (const it of items) {
    ensureSpace(20)
    if (it.is_section) {
      y -= 4
      page.drawRectangle({ x: marginX - 6, y: y - 4, width: width - 2 * marginX + 12, height: 16, color: lightGray })
      draw(String(it.description ?? "").toUpperCase(), colDesc, y, { font: fontBold, size: 8, color: gray })
      y -= 20
      continue
    }
    draw(String(it.description ?? "").slice(0, 70), colDesc, y, { size: 9 })
    draw(String(it.quantite ?? ""), colQty + 30, y, { align: "right", size: 9 })
    draw(`${Number(it.prix_unitaire_ht ?? 0).toFixed(2)} \u20ac`, colPu + 50, y, { align: "right", size: 9 })
    draw(`${Number(it.total_ht ?? 0).toFixed(2)} \u20ac`, colTotal, y, { align: "right", size: 9 })
    y -= 16
  }

  ensureSpace(90)
  y -= 6
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: lightGray })
  y -= 20

  const totalsLabelX = width - marginX - 150
  draw("Total HT", totalsLabelX, y, { size: 9, color: gray })
  draw(`${Number(facture.total_ht ?? 0).toFixed(2)} \u20ac`, width - marginX, y, { align: "right", size: 9 })
  y -= 15
  draw("TVA", totalsLabelX, y, { size: 9, color: gray })
  draw(`${Number(facture.tva_montant ?? 0).toFixed(2)} \u20ac`, width - marginX, y, { align: "right", size: 9 })
  y -= 18
  page.drawLine({ start: { x: totalsLabelX, y: y + 8 }, end: { x: width - marginX, y: y + 8 }, thickness: 0.5, color: lightGray })
  draw("Total TTC", totalsLabelX, y, { font: fontBold, size: 12, color: accentColor })
  draw(`${Number(facture.total_ttc ?? 0).toFixed(2)} \u20ac`, width - marginX, y, { font: fontBold, size: 12, align: "right", color: accentColor })

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
    .select("*, clients(*), orgs(nom, siret, tva_intracommunautaire, adresse, ville, cp, pays, tel, email, logo_url, couleur_principale, devis_settings), devis(devis_items(*))")
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
  const allItems = (devis?.devis_items as any[]) ?? []
  const itemsPourXml = allItems.filter((it) => !it.is_section) // le XML CII ne prend que les vraies lignes

  if (!c) return NextResponse.json({ error: "no_client" }, { status: 400 })
  if (itemsPourXml.length === 0) return NextResponse.json({ error: "no_items" }, { status: 400 })

  try {
    // Le PDF affiche TOUT (sections comprises), le XML CII ne prend que les lignes réelles
    const basePdf = await buildBasePdf(facture, org, c, allItems)

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
      lignes: itemsPourXml.map((it) => ({
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
