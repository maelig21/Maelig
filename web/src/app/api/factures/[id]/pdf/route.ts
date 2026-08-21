/**
 * Facture PDF — vrai PDF binaire via Puppeteer (nécessaire pour Factur-X).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatEUR, formatDateFR } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

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

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Inter, Arial, sans-serif; color: #18181b; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .title { font-size: 28px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 20px; }
  th { text-align: left; border-bottom: 2px solid #333; padding: 8px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .totals { margin-top: 16px; width: 250px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { font-weight: 800; font-size: 16px; border-top: 2px solid #333; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-weight:700; font-size:18px;">${org.nom ?? ""}</div>
      <div style="font-size:12px; color:#666;">${org.adresse ?? ""}</div>
      <div style="font-size:12px; color:#666;">${org.cp ?? ""} ${org.ville ?? ""}</div>
      ${org.siret ? `<div style="font-size:12px; color:#666;">SIRET : ${org.siret}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div class="title">FACTURE</div>
      <div style="font-size:12px; color:#666;">N° ${facture.numero ?? ""}</div>
      <div style="font-size:12px; color:#666;">${formatDateFR(facture.date_emission ?? "")}</div>
    </div>
  </div>

  <div style="font-size:13px; margin-bottom:16px;">
    <strong>Facturé à :</strong> ${client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ")}<br/>
    ${client.adresse ?? ""}
  </div>

  <table>
    <thead>
      <tr><th>Désignation</th><th class="right">Qté</th><th class="right">PU HT</th><th class="right">Total HT</th></tr>
    </thead>
    <tbody>
      ${items.map((it) => `<tr><td>${it.description}</td><td class="right">${it.quantite}</td><td class="right">${formatEUR(it.prix_unitaire_ht)}</td><td class="right">${formatEUR(it.total_ht)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Total HT</span><span>${formatEUR(facture.total_ht)}</span></div>
    <div><span>TVA</span><span>${formatEUR(facture.tva_montant)}</span></div>
    <div class="grand"><span>Total TTC</span><span>${formatEUR(facture.total_ttc)}</span></div>
  </div>
</body>
</html>`

  try {
    const chromium = (await import("@sparticuz/chromium")).default
    const puppeteer = await import("puppeteer-core")

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true })
    await browser.close()

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${facture.numero ?? id.slice(0, 8)}.pdf"`,
      },
    })
  } catch (e) {
    console.error("[facture pdf] puppeteer failed:", e)
    return new Response(html, { headers: { "Content-Type": "text/html" } })
  }
}
