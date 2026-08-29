/**
 * Facture PDF — vrai PDF binaire via PDFKit avec polices correctement
 * embarquées (contrairement à jsPDF qui référence toujours les 14 polices
 * standard PDF même quand on n'en utilise aucune — incompatible PDF/A-3).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatEUR, formatDateFR } from "@/lib/utils"
import PDFDocument from "pdfkit"
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "@/lib/facturx/embedded-fonts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 20

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return new Response("invalid id", { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("unauthorized", { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const { data: facture } = await supabase
    .from("factures")
    .select("*, clients(*), orgs(*), devis(objet, devis_items(*))")
    .eq("id", id)
    .eq("org_id", profile!.org_id!)
    .maybeSingle()

  if (!facture) return new Response("not found", { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (facture.orgs as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (facture.clients as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devis = (facture.devis as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((devis.devis_items as any[]) ?? []).filter((it) => !it.is_section)

  const regularBuf = Buffer.from(LIBERATION_SANS_REGULAR, "base64")
  const boldBuf = Buffer.from(LIBERATION_SANS_BOLD, "base64")

  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true, pdfVersion: "1.7" })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.registerFont("LibSans", regularBuf)
    doc.registerFont("LibSans-Bold", boldBuf)
    doc.font("LibSans")

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const startX = doc.page.margins.left

    // En-tête entreprise (gauche)
    doc.font("LibSans-Bold").fontSize(14).text(org.nom ?? "", startX, 50)
    doc.font("LibSans").fontSize(9)
    if (org.adresse) doc.text(org.adresse)
    if (org.cp || org.ville) doc.text(`${org.cp ?? ""} ${org.ville ?? ""}`)
    if (org.siret) doc.text(`SIRET : ${org.siret}`)

    // Titre + numéro (droite)
    doc.font("LibSans-Bold").fontSize(22).text("FACTURE", startX, 50, { width: pageWidth, align: "right" })
    doc.font("LibSans").fontSize(9)
    doc.text(`N° ${facture.numero ?? ""}`, { width: pageWidth, align: "right" })
    doc.text(formatDateFR(facture.date_emission ?? ""), { width: pageWidth, align: "right" })

    doc.moveDown(2)

    // Client
    doc.font("LibSans-Bold").fontSize(10).text("Facturé à :")
    doc.font("LibSans").fontSize(9)
    doc.text(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || "")
    if (client.adresse) doc.text(client.adresse)

    doc.moveDown(1.5)

    // Tableau — en-têtes
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
      doc.text(formatEUR(it.prix_unitaire_ht), colPu, y, { width: 60, align: "right" })
      doc.text(formatEUR(it.total_ht), colTotal, y, { width: 60, align: "right" })
      y += Math.max(descHeight, 12) + 4
    }

    y += 4
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(0.5).stroke()
    y += 12

    // Totaux
    const totalsX = startX + pageWidth - 150
    doc.font("LibSans").fontSize(9)
    doc.text("Total HT", totalsX, y, { width: 90 })
    doc.text(formatEUR(facture.total_ht), totalsX + 90, y, { width: 60, align: "right" })
    y += 14
    doc.text("TVA", totalsX, y, { width: 90 })
    doc.text(formatEUR(facture.tva_montant), totalsX + 90, y, { width: 60, align: "right" })
    y += 16
    doc.font("LibSans-Bold").fontSize(11)
    doc.text("Total TTC", totalsX, y, { width: 90 })
    doc.text(formatEUR(facture.total_ttc), totalsX + 90, y, { width: 60, align: "right" })

    doc.end()
  })

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${facture.numero ?? id.slice(0, 8)}.pdf"`,
    },
  })
}
