import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildFacturXXml, embedFacturXInPdf } from "@/lib/facturx/generate"

export const runtime = "nodejs"
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const xml = buildFacturXXml({
      numero: facture.numero ?? id.slice(0, 8),
      dateEmission: facture.date_emission ?? new Date().toISOString().slice(0, 10),
      dateEcheance: facture.date_echeance ?? undefined,
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

    // Récupérer le PDF classique déjà généré (endpoint existant)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(_req.url).origin
    const pdfRes = await fetch(`${baseUrl}/api/factures/${id}/pdf`, {
      headers: { cookie: _req.headers.get("cookie") ?? "" },
    })
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "pdf_generation_failed" }, { status: 500 })
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    const facturXPdf = await embedFacturXInPdf(pdfBuffer, xml, {
      author: org?.nom ?? "DEP",
      title: `Facture ${facture.numero ?? id.slice(0, 8)}`,
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
