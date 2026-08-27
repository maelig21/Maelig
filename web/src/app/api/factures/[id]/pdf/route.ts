/**
 * Facture PDF — vrai PDF binaire via jsPDF (pas de navigateur headless,
 * fiable sur Vercel contrairement à puppeteer/chromium).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatEUR, formatDateFR } from "@/lib/utils"
import { jsPDF } from "jspdf"

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

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 20
  let y = 20

  // En-tête entreprise
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(org.nom ?? "", marginX, y)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  y += 6
  if (org.adresse) { doc.text(org.adresse, marginX, y); y += 4 }
  if (org.cp || org.ville) { doc.text(`${org.cp ?? ""} ${org.ville ?? ""}`, marginX, y); y += 4 }
  if (org.siret) { doc.text(`SIRET : ${org.siret}`, marginX, y); y += 4 }

  // Titre + numéro (à droite)
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURE", pageWidth - marginX, 20, { align: "right" })
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`N° ${facture.numero ?? ""}`, pageWidth - marginX, 27, { align: "right" })
  doc.text(formatDateFR(facture.date_emission ?? ""), pageWidth - marginX, 32, { align: "right" })

  y = Math.max(y, 40) + 6

  // Client
  doc.setFont("helvetica", "bold")
  doc.text("Facturé à :", marginX, y)
  doc.setFont("helvetica", "normal")
  y += 5
  doc.text(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || "", marginX, y)
  y += 4
  if (client.adresse) { doc.text(client.adresse, marginX, y); y += 4 }

  y += 8

  // Tableau des lignes
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Désignation", marginX, y)
  doc.text("Qté", pageWidth - marginX - 55, y, { align: "right" })
  doc.text("PU HT", pageWidth - marginX - 30, y, { align: "right" })
  doc.text("Total HT", pageWidth - marginX, y, { align: "right" })
  y += 2
  doc.setLineWidth(0.3)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 5

  doc.setFont("helvetica", "normal")
  for (const it of items) {
    if (y > 260) { doc.addPage(); y = 20 }
    const desc = doc.splitTextToSize(String(it.description ?? ""), 100)
    doc.text(desc, marginX, y)
    doc.text(String(it.quantite ?? ""), pageWidth - marginX - 55, y, { align: "right" })
    doc.text(formatEUR(it.prix_unitaire_ht), pageWidth - marginX - 30, y, { align: "right" })
    doc.text(formatEUR(it.total_ht), pageWidth - marginX, y, { align: "right" })
    y += 5 * (Array.isArray(desc) ? desc.length : 1) + 1
  }

  y += 4
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Totaux
  const totalsX = pageWidth - marginX - 60
  doc.text("Total HT", totalsX, y)
  doc.text(formatEUR(facture.total_ht), pageWidth - marginX, y, { align: "right" })
  y += 5
  doc.text("TVA", totalsX, y)
  doc.text(formatEUR(facture.tva_montant), pageWidth - marginX, y, { align: "right" })
  y += 5
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Total TTC", totalsX, y)
  doc.text(formatEUR(facture.total_ttc), pageWidth - marginX, y, { align: "right" })

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${facture.numero ?? id.slice(0, 8)}.pdf"`,
    },
  })
}
