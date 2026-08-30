import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardTitle } from "@/components/ui/card"
import { SuperPdpForm } from "./client"

export const dynamic = "force-dynamic"

export default async function Page() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user!.id).maybeSingle()
  const isOwner = profile?.role === "owner" || profile?.role === "admin_dep"

  const { data: org } = await supabase
    .from("orgs")
    .select("facturation_electronique_active, superpdp_client_id, superpdp_electronic_address")
    .eq("id", profile!.org_id!)
    .maybeSingle()

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
      <Link href="/app/parametres/societe" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
        <ArrowLeft className="h-3 w-3" /> Paramètres société
      </Link>

      <div>
        <CardTitle>⚡ Facturation électronique</CardTitle>
        <p className="mt-2 text-sm text-muted">
          La réforme française rend obligatoire la transmission de vos factures via une <strong>plateforme agréée (PA)</strong>
          {" "}officielle — émission dès septembre 2026 pour les grandes entreprises et ETI, dès septembre 2027 pour les TPE/PME.
          DEP vous accompagne pour vous connecter gratuitement à <strong>Super PDP</strong>, une plateforme française agréée par la DGFiP.
        </p>
      </div>

      <Card>
        <h3 className="font-display font-semibold mb-4">📋 Étape 1 — Créez votre compte Super PDP (gratuit)</h3>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">1</span>
            <span>Allez sur <a href="https://www.superpdp.tech" target="_blank" rel="noopener" className="text-electric underline">superpdp.tech</a> et cliquez sur <strong>« Créer un compte »</strong> (email + mot de passe).</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">2</span>
            <span>Validez le code reçu par email, puis activez la double authentification.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">3</span>
            <span>Cliquez sur <strong>« Ajouter entreprise »</strong> et renseignez votre numéro <strong>SIREN</strong> (9 chiffres — pas le SIRET). Super PDP retrouve automatiquement le nom de votre entreprise.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">4</span>
            <span>Sélectionnez le représentant légal, cochez <strong>« Accord formel »</strong>, puis choisissez d&apos;inscrire votre adresse dès maintenant à l&apos;annuaire.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">5</span>
            <span>Terminez la <strong>vérification d&apos;identité</strong> (QR code + photo de pièce d&apos;identité).</span>
          </li>
        </ol>
      </Card>

      <Card>
        <h3 className="font-display font-semibold mb-4">🔑 Étape 2 — Créez une application (clés API)</h3>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">1</span>
            <span>Dans votre compte Super PDP, cliquez sur <strong>« Applications »</strong> puis <strong>« Nouvelle application »</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">2</span>
            <span>Choisissez <strong>« Production »</strong> (pas Bac à sable), sélectionnez votre entreprise, et laissez les URLs de redirection vides.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">3</span>
            <span>Choisissez le type <strong>« Confidentielle »</strong>, puis cliquez sur <strong>« Créer »</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-electric text-black font-bold text-xs flex items-center justify-center">4</span>
            <span><strong className="text-amber-600">⚠️ Important :</strong> notez immédiatement le <strong>client_id</strong> et le <strong>client_secret</strong> affichés — le secret ne s&apos;affiche qu&apos;une seule fois !</span>
          </li>
        </ol>
      </Card>

      <Card>
        <h3 className="font-display font-semibold mb-4">🔌 Étape 3 — Connectez Super PDP à DEP</h3>
        <p className="text-sm text-muted mb-4">
          Collez ci-dessous les identifiants que vous venez d&apos;obtenir. Ils resteront strictement privés à votre entreprise.
        </p>
        <SuperPdpForm
          isOwner={isOwner}
          initialClientId={org?.superpdp_client_id ?? ""}
          hasSecret={!!org?.superpdp_client_id}
          initialActive={org?.facturation_electronique_active ?? false}
        />
      </Card>

      <p className="text-xs text-muted text-center">
        Besoin d&apos;aide ? Contactez Super PDP directement : <a href="mailto:support@superpdp.tech" className="text-electric underline">support@superpdp.tech</a>
      </p>
    </div>
  )
}
