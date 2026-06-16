import { createSupabaseServerClient } from "@/lib/supabase/server"
import { FacturesTable, ListHeader } from "@/components/devis/devis-table"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user!.id).maybeSingle()

  const statuts = filtre === "payee" ? ["payee"] : filtre === "abandonnee" ? ["abandonnee"] : ["payee", "abandonnee"]

  const { data: rows } = await supabase
    .from("factures")
    .select("id, numero, statut, total_ttc, date_emission, date_echeance, relances_count, clients(nom, prenom, raison_sociale)")
    .eq("org_id", profile!.org_id!)
    .in("statut", statuts)
    .order("date_emission", { ascending: false })
    .limit(200)

  const btnClass = (val: string) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
      (filtre ?? "tout") === val
        ? "bg-electric text-white"
        : "bg-surface-2 text-muted hover:text-foreground"
    }`

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-10">
      <ListHeader
        title="Factures payées · abandonnées"
        description="L'historique complet. Conservé 10 ans pour vos obligations comptables."
      />

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        <Link href="/app/devis/archives" className={btnClass("tout")}>Toutes</Link>
        <Link href="/app/devis/archives?filtre=payee" className={btnClass("payee")}>✅ Payées</Link>
        <Link href="/app/devis/archives?filtre=abandonnee" className={btnClass("abandonnee")}>❌ Abandonnées</Link>
      </div>

      <FacturesTable rows={(rows ?? []) as never} />
    </div>
  )
}
