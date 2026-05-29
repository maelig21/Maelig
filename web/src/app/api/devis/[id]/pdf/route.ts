/**
 * Devis PDF — version HTML imprimable (browser print-to-PDF).
 * Pour un vrai PDF binaire, on basculera plus tard sur @react-pdf/renderer ou puppeteer.
 */
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatEUR, formatDateFR } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("unauthorized", { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()

  const { data: devis } = await supabase
    .from("devis")
    .select("*, clients(*), devis_items(*), orgs(*)")
    .eq("id", id)
    .eq("org_id", profile!.org_id!)
    .maybeSingle()

  if (!devis) return new Response("not found", { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (devis.orgs as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (devis.clients as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (devis.devis_items as any[]) ?? []

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Devis ${devis.numero}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  body { font-family: Inter, -apple-system, Segoe UI, sans-serif; color: #111; background: #fff; }
  .wrap { max-width: 760px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ffd500; padding-bottom: 18px; margin-bottom: 18px; }
  .logo img { max-height: 64px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: -0.5px; }
  .muted { color: #666; font-size: 11px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 18px; }
  .box { border: 1px solid #e5e5e5; padding: 14px; border-radius: 8px; background: #fafafa; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; background: #111; color: #fff; padding: 9px 8px; }
  th.r, td.r { text-align: right; }
  td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: top; }
  tfoot td { border-bottom: 0; padding-top: 10px; font-size: 13px; }
  tfoot .total td { background: #ffd500; color: #000; font-weight: 800; font-size: 16px; padding: 12px 8px; }
  .signature { margin-top: 36px; border: 2px dashed #ccc; padding: 14px; min-height: 90px; }
  .signature small { color: #888; }
  footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">
      ${org.logo_url ? `<img src="${escapeAttr(org.logo_url)}" alt="${escapeAttr(org.nom)}" />` : `<h1>${escapeHtml(org.nom || "DEP")}</h1>`}
      <div class="muted">${escapeHtml([org.adresse, org.cp, org.ville].filter(Boolean).join(" · "))}</div>
      <div class="muted">${escapeHtml(org.email || "")} · ${escapeHtml(org.tel || "")}</div>
      <div class="muted">SIRET ${escapeHtml(org.siret || "—")}</div>
    </div>
    <div style="text-align:right">
      <h1>Devis n° ${escapeHtml(devis.numero || "")}</h1>
      <div class="muted">Émis le ${formatDateFR(devis.date_emission)}</div>
      <div class="muted">Valable jusqu'au ${devis.date_validite ? formatDateFR(devis.date_validite) : "—"}</div>
    </div>
  </header>

  <div class="grid2">
    <div class="box">
      <strong>Client</strong><br>
      ${escapeHtml(client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" "))}<br>
      ${client.email ? `<span class="muted">${escapeHtml(client.email)}</span><br>` : ""}
      ${client.telephone ? `<span class="muted">${escapeHtml(client.telephone)}</span><br>` : ""}
      ${client.adresse ? `<span class="muted">${escapeHtml([client.adresse, client.cp, client.ville].filter(Boolean).join(" · "))}</span>` : ""}
    </div>
    <div class="box">
      <strong>Chantier</strong><br>
      ${escapeHtml(devis.objet || "—")}<br>
      <span class="muted">${escapeHtml(devis.chantier_adresse || "—")}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="r" style="width:60px">Qté</th>
        <th style="width:50px">Unité</th>
        <th class="r" style="width:90px">PU HT</th>
        <th class="r" style="width:100px">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it) => `
        <tr>
          <td>${escapeHtml(it.description)}</td>
          <td class="r">${it.quantite}</td>
          <td>${escapeHtml(it.unite || "u")}</td>
          <td class="r">${formatEUR(it.prix_unitaire_ht)}</td>
          <td class="r">${formatEUR(it.total_ht)}</td>
        </tr>
      `).join("")}
      ${Number(devis.heures_main_oeuvre) > 0 ? `
        <tr>
          <td>Main-d'œuvre · pose</td>
          <td class="r">${devis.heures_main_oeuvre}</td>
          <td>h</td>
          <td class="r">${formatEUR(devis.taux_horaire)}</td>
          <td class="r">${formatEUR(devis.cout_main_oeuvre_ht)}</td>
        </tr>
      ` : ""}
    </tbody>
    <tfoot>
      <tr><td colspan="4" class="r">Total HT</td><td class="r">${formatEUR(devis.total_ht)}</td></tr>
      <tr><td colspan="4" class="r">TVA (${devis.tva_taux}%)</td><td class="r">${formatEUR(devis.tva_montant)}</td></tr>
      <tr class="total"><td colspan="4" class="r">TOTAL TTC</td><td class="r">${formatEUR(devis.total_ttc)}</td></tr>
    </tfoot>
  </table>

  ${devis.notes_client ? `<div class="box" style="margin-top:18px"><strong>Notes</strong><br>${escapeHtml(devis.notes_client)}</div>` : ""}

  <div class="signature">
    <small>Bon pour accord — signature du client (précédée de la mention &laquo; lu et approuvé &raquo;)</small>
  </div>

  ${org.conditions_reglement ? `
  <div class="box" style="margin-top:18px">
    <strong>Conditions de règlement</strong><br>
    <span style="white-space:pre-line">${escapeHtml(org.conditions_reglement)}</span>
  </div>
  ` : ""}

  <footer>
    Devis valable 30 jours. Acompte demandé : ${devis.acompte_pct ? devis.acompte_pct + "%" : "—"}.
    ${org.tva_intracommunautaire ? `· TVA intra : ${escapeHtml(org.tva_intracommunautaire)}` : ""}
  </footer>
</div>
<script>window.onload = () => setTimeout(() => window.print(), 200)</script>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s)
}
